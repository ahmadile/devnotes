import React, { useEffect, useRef } from 'react';

interface BeamsBackgroundProps {
  className?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
  color?: 'violet' | 'cyan' | 'emerald' | 'multi';
}

export const BeamsBackground: React.FC<BeamsBackgroundProps> = ({
  className = '',
  intensity = 'subtle',
  color = 'multi',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Laser rays definition inspired by ReactBits Beams & Light Rays
    const opacityMult = intensity === 'subtle' ? 0.22 : intensity === 'medium' ? 0.45 : 0.7;

    const beams = [
      { x: 0.15, speed: 0.0008, width: 140, hue: 270, alpha: 0.45 * opacityMult }, // Violet
      { x: 0.45, speed: -0.0006, width: 180, hue: 190, alpha: 0.5 * opacityMult }, // Cyan
      { x: 0.75, speed: 0.0007, width: 160, hue: 285, alpha: 0.4 * opacityMult }, // Magenta/Purple
      { x: 0.90, speed: -0.0009, width: 130, hue: 165, alpha: 0.35 * opacityMult }, // Emerald/Cyan
    ];

    let t = 0;

    const render = () => {
      t += 1;
      ctx.clearRect(0, 0, width, height);

      // Draw each laser ray beam with additive blending
      ctx.globalCompositeOperation = 'lighter';

      beams.forEach((beam, idx) => {
        const currentX = (beam.x + Math.sin(t * beam.speed + idx) * 0.08) * width;
        const beamW = beam.width * (1 + Math.sin(t * 0.002 + idx) * 0.15);

        // Linear gradient from top laser source to bottom fade
        const grad = ctx.createLinearGradient(currentX, 0, currentX + (idx % 2 === 0 ? 80 : -80), height);
        
        let c1 = '139, 92, 246'; // violet
        let c2 = '6, 182, 212';  // cyan
        if (color === 'cyan') {
          c1 = '6, 182, 212';
          c2 = '56, 189, 248';
        } else if (color === 'violet') {
          c1 = '168, 85, 247';
          c2 = '139, 92, 246';
        } else if (color === 'emerald') {
          c1 = '16, 185, 129';
          c2 = '52, 211, 153';
        }

        const activeColor = idx % 2 === 0 ? c1 : c2;

        grad.addColorStop(0, `rgba(${activeColor}, ${beam.alpha * 1.2})`);
        grad.addColorStop(0.3, `rgba(${activeColor}, ${beam.alpha * 0.7})`);
        grad.addColorStop(0.7, `rgba(${activeColor}, ${beam.alpha * 0.25})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(currentX - beamW * 0.5, 0);
        ctx.lineTo(currentX + beamW * 0.5, 0);
        ctx.lineTo(currentX + beamW * 1.2 + (idx % 2 === 0 ? 120 : -120), height);
        ctx.lineTo(currentX - beamW * 1.2 + (idx % 2 === 0 ? 120 : -120), height);
        ctx.closePath();
        ctx.fill();

        // Laser core bright centerline
        const coreGrad = ctx.createLinearGradient(currentX, 0, currentX, height * 0.7);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${beam.alpha * 0.8})`);
        coreGrad.addColorStop(0.4, `rgba(${activeColor}, ${beam.alpha * 0.5})`);
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.strokeStyle = coreGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX + (idx % 2 === 0 ? 100 : -100), height);
        ctx.stroke();
      });

      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, color]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Laser Beams Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-70 dark:opacity-85 mix-blend-screen"
      />
      {/* ReactBits Pro ambient vignette */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_0%] from-transparent via-transparent to-background/90" />
    </div>
  );
};
