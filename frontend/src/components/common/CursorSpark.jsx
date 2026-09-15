import { useEffect } from 'react';

const SPARK_COUNT = 8;

export default function CursorSpark() {
  useEffect(() => {
    function handlePointerDown(event) {
      if (event.button !== 0) return;

      const burst = document.createElement('span');
      burst.className = 'cursor-spark-burst';
      burst.style.left = `${event.clientX}px`;
      burst.style.top = `${event.clientY}px`;

      for (let index = 0; index < SPARK_COUNT; index += 1) {
        const spark = document.createElement('i');
        const angle = (360 / SPARK_COUNT) * index + (Math.random() * 16 - 8);
        const distance = 22 + Math.random() * 14;
        const size = 3 + Math.random() * 3;

        spark.className = 'cursor-spark';
        spark.style.setProperty('--spark-angle', `${angle}deg`);
        spark.style.setProperty('--spark-distance', `${distance}px`);
        spark.style.setProperty('--spark-size', `${size}px`);
        burst.appendChild(spark);
      }

      document.body.appendChild(burst);
      burst.addEventListener('animationend', () => burst.remove(), { once: true });
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return null;
}
