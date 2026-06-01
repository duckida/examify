import { useMemo } from 'react';

interface Props {
  text: string;
}

const BULLET_RE = /^\s*[-*–•]\s+/;

export default function BulletList({ text }: Props) {
  const items = useMemo(() => {
    if (!text) return [];
    const lines = text.split('\n');
    const result: { bullet: boolean; text: string }[] = [];
    let buffer: { bullet: boolean; text: string } | null = null;

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) {
        if (buffer !== null) {
          result.push(buffer);
          buffer = null;
        }
        continue;
      }
      if (BULLET_RE.test(line)) {
        if (buffer !== null) result.push(buffer);
        buffer = { bullet: true, text: line.replace(BULLET_RE, '').trim() };
      } else {
        if (buffer === null) {
          buffer = { bullet: false, text: line.trim() };
        } else if (buffer.bullet) {
          result.push(buffer);
          buffer = { bullet: false, text: line.trim() };
        } else {
          buffer = { bullet: false, text: buffer.text + ' ' + line.trim() };
        }
      }
    }
    if (buffer !== null) result.push(buffer);
    return result;
  }, [text]);

  if (items.length === 0) return null;

  const nonBullet = items.filter(i => !i.bullet);
  const bullets = items.filter(i => i.bullet);

  if (bullets.length === 0) {
    return (
      <div className="bullet-list">
        {nonBullet.map((item, i) => (
          <p key={i} className="pre-wrap">{item.text}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="bullet-list">
      {nonBullet.length > 0 && (
        <p className="pre-wrap">{nonBullet.map(i => i.text).join(' ')}</p>
      )}
      <ul>
        {bullets.map((item, i) => (
          <li key={i}>{item.text}</li>
        ))}
      </ul>
    </div>
  );
}
