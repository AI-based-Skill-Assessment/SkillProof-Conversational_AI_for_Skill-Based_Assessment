import '../../styles/common/primitives.css';

export default function Skeleton({ type = 'text', width, height, circle = false, className = '' }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`common-skeleton common-skeleton--${type}${circle ? ' common-skeleton--circle' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
