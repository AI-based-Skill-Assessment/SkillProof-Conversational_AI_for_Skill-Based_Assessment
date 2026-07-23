# =============================================================================
# app/core/face_verifier.py
# Backend Face Verification Engine using DeepFace (ArcFace R50 backend).
# Includes upscaling pipeline, multi-face detection, and detailed diagnostics.
# =============================================================================

import cv2
import numpy as np
import base64
import math
from typing import List, Optional, Dict, Any


class BackendFaceVerifier:
    def __init__(self) -> None:
        self._deepface = None

    def _get_deepface(self):
        if self._deepface is None:
            try:
                from deepface import DeepFace
                self._deepface = DeepFace
            except ImportError as e:
                print(f"[BackendFaceVerifier] DeepFace not available: {e}")
                raise RuntimeError("DeepFace library is not installed on the system.")
        return self._deepface

    def base64_to_cv2(self, base64_str: str) -> np.ndarray:
        """Converts base64 image data URL or raw base64 string to OpenCV BGR image."""
        if "," in base64_str:
            header, data = base64_str.split(",", 1)
        else:
            data = base64_str

        img_bytes = base64.b64decode(data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode base64 string into a valid image.")
        return img

    def process_low_res_pipeline(self, img: np.ndarray) -> np.ndarray:
        """
        Low-res camera pipeline:
        1. Bicubic upscale raw frame to 640x480 if smaller.
        2. Detect and crop face region using OpenCV Haar Cascade.
        3. If cropped region is smaller than 60x60px, upscale it again to 112x112.
        """
        h, w = img.shape[:2]

        if w < 640 or h < 480:
            img = cv2.resize(img, (640, 480), interpolation=cv2.INTER_CUBIC)
            h, w = img.shape[:2]

        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)

        if len(faces) > 0:
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            x, y, fw, fh = faces[0]
            face_crop = img[y:y+fh, x:x+fw]
            if fw < 60 or fh < 60:
                face_crop = cv2.resize(face_crop, (112, 112), interpolation=cv2.INTER_CUBIC)
            return face_crop

        return img

    def detect_faces(self, img: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect all faces in the image. Returns list of face dicts with:
        - bbox: (x, y, w, h)
        - area: pixel area
        - confidence: detection confidence
        Used for multi-face detection (proxy detection).
        """
        h, w = img.shape[:2]
        if w < 640 or h < 480:
            img = cv2.resize(img, (640, 480), interpolation=cv2.INTER_CUBIC)

        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)

        result = []
        for (x, y, fw, fh) in faces:
            area = fw * fh
            confidence = min(1.0, area / (100 * 100))
            result.append({
                "bbox": (int(x), int(y), int(fw), int(fh)),
                "area": int(area),
                "confidence": round(confidence, 4)
            })

        result.sort(key=lambda f: f["area"], reverse=True)
        return result

    def extract_arcface_embedding(self, face_img: np.ndarray) -> List[float]:
        """
        Extracts 512-dim ArcFace embedding from a face image.
        Uses DeepFace with 'ArcFace' model and OpenCV detector backend.
        """
        df = self._get_deepface()

        results = df.represent(
            img_path=face_img,
            model_name="ArcFace",
            detector_backend="skip",
            enforce_detection=False
        )

        if results and len(results) > 0:
            embedding = results[0]["embedding"]
            return [float(x) for x in embedding]

        raise ValueError("Could not extract face embedding using ArcFace backend.")

    def verify_faces(
        self,
        registered_embedding: List[float],
        live_face_img: np.ndarray,
    ) -> Dict[str, Any]:
        """
        Full verification pipeline:
        1. Process low-res pipeline (upscale + face crop)
        2. Extract ArcFace embedding from live frame
        3. Compute cosine similarity
        4. Return detailed verification result
        """
        processed = self.process_low_res_pipeline(live_face_img)
        live_embedding = self.extract_arcface_embedding(processed)
        similarity = self.cosine_similarity(registered_embedding, live_embedding)

        return {
            "match": similarity >= 0.40,
            "confidence": round(similarity, 4),
            "embedding": live_embedding,
            "message": (
                "Face verified successfully."
                if similarity >= 0.40
                else f"Face mismatch detected (similarity={similarity:.4f}, threshold=0.40). "
                     "The live face does not match the registered profile."
            )
        }

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Computes cosine similarity between two float vectors."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        mag_a = math.sqrt(sum(a * a for a in vec_a))
        mag_b = math.sqrt(sum(b * b for b in vec_b))
        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot / (mag_a * mag_b)
