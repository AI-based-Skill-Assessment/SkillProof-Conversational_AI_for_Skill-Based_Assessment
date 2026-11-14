"""
Build the benchmark manifest from the extracted datasets.

usage: python -m eval.benchmark.prepare_lists <data dir> <out dir>
  <data dir> contains lfw/ (images), pairs.txt and LibriSpeech/dev-clean/
Writes:
  face_list.txt    image URL paths to run through face_extract.cjs
  manifest.json    LFW pairs, chimeric subjects (LFW person + LibriSpeech speaker), voice utterances
"""
import json
import os
import sys
from collections import defaultdict

CHIMERIC_SUBJECTS = 40          # = number of LibriSpeech dev-clean speakers
IMAGES_PER_SUBJECT = 10         # 1 enrolment + 9 probes
UTTS_PER_SPEAKER_VOICE = 20     # 1 enrolment + up to 19 probes (voice-only protocol)


def lfw_path(name, n):
    return f"/data/lfw/{name}/{name}_{int(n):04d}.jpg"


def main(data_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)

    # LFW standard verification protocol: 10 folds x (300 matched + 300 mismatched)
    pairs = []
    with open(os.path.join(data_dir, "pairs.txt"), encoding="utf-8") as fh:
        header = fh.readline().split()
        for line in fh:
            parts = line.strip().split("\t")
            if len(parts) == 3:
                pairs.append({"a": lfw_path(parts[0], parts[1]), "b": lfw_path(parts[0], parts[2]), "same": True})
            elif len(parts) == 4:
                pairs.append({"a": lfw_path(parts[0], parts[1]), "b": lfw_path(parts[2], parts[3]), "same": False})
    expected = (int(header[0]) * int(header[1]) if len(header) == 2 else int(header[0])) * 2
    assert len(pairs) == expected, f"unexpected pairs count {len(pairs)} (expected {expected})"

    # People with the most images -> chimeric subjects (one LFW identity + one speaker)
    counts = defaultdict(list)
    lfw_root = os.path.join(data_dir, "lfw")
    for name in sorted(os.listdir(lfw_root)):
        imgs = sorted(f for f in os.listdir(os.path.join(lfw_root, name)) if f.endswith(".jpg"))
        if len(imgs) >= IMAGES_PER_SUBJECT:
            counts[name] = imgs
    people = sorted(counts, key=lambda n: (-len(counts[n]), n))[:CHIMERIC_SUBJECTS]

    speakers = []
    libri_root = os.path.join(data_dir, "LibriSpeech", "dev-clean")
    for spk in sorted(os.listdir(libri_root), key=int):
        utts = []
        for chapter in sorted(os.listdir(os.path.join(libri_root, spk))):
            for f in sorted(os.listdir(os.path.join(libri_root, spk, chapter))):
                if f.endswith(".flac"):
                    utts.append(os.path.join("LibriSpeech", "dev-clean", spk, chapter, f))
        speakers.append({"speaker": spk, "utterances": utts[:UTTS_PER_SPEAKER_VOICE]})

    chimeric = []
    for k, (person, spk) in enumerate(zip(people, speakers)):
        chimeric.append({
            "subject": f"c{k:02d}", "lfw_person": person, "speaker": spk["speaker"],
            "images": [f"/data/lfw/{person}/{f}" for f in counts[person][:IMAGES_PER_SUBJECT]],
            "utterances": spk["utterances"][:IMAGES_PER_SUBJECT],
        })

    face_images = sorted({p["a"] for p in pairs} | {p["b"] for p in pairs} | {i for c in chimeric for i in c["images"]})
    with open(os.path.join(out_dir, "face_list.txt"), "w") as fh:
        fh.write("\n".join(face_images) + "\n")
    json.dump({"pairs": pairs, "chimeric": chimeric, "speakers": speakers},
              open(os.path.join(out_dir, "manifest.json"), "w"), indent=1)
    print(f"{len(pairs)} LFW pairs, {len(face_images)} unique face images, "
          f"{len(chimeric)} chimeric subjects, {len(speakers)} speakers, "
          f"{sum(len(s['utterances']) for s in speakers)} utterances")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
