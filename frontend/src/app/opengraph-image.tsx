/* eslint-disable @next/next/no-img-element -- ImageResponse renders image elements without the Next image optimizer. */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Kainara — Filipino meal planning and nutrition tracking';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), 'public/icons/icon-512.png'));
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '52px 68px',
        background: '#071914',
        color: '#faf8f5',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <img src={`data:image/png;base64,${logo.toString('base64')}`} width={78} height={78} alt="" />
        <span style={{ fontSize: 42, fontWeight: 700 }}>KAINARA</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.08,
            maxWidth: 980,
          }}
        >
          <span>Filipino meal planning,</span>
          <span>made personal.</span>
        </div>
        <div style={{ fontSize: 28, color: '#c0d5cc' }}>Meal plans · Nutrition tracking · RND review</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 24, color: '#f09e6c' }}>kainara.site</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {['#eb6a38', '#f09e6c', '#128164'].map((color) => (
            <div key={color} style={{ width: 64, height: 10, borderRadius: 5, background: color }} />
          ))}
        </div>
      </div>
    </div>,
    {
      ...size,
    }
  );
}
