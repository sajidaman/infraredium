"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  warm: boolean;
};

const stars: Star[] = Array.from({ length: 112 }, (_, index) => {
  const seed = index + 1;
  const randomX = Math.sin(seed * 12.9898) * 43758.5453;
  const randomY = Math.sin(seed * 78.233) * 24634.6345;

  return {
    x: randomX - Math.floor(randomX),
    y: randomY - Math.floor(randomY),
    radius: index % 17 === 0 ? 1.65 : index % 5 === 0 ? 1.1 : 0.65,
    alpha: index % 4 === 0 ? 0.78 : 0.43,
    warm: index % 9 === 0,
  };
});

export default function SkyViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
    const context = gl ? null : canvas.getContext("2d");
    if (!gl && !context) return;

    let program: WebGLProgram | null = null;
    let vertexArray: WebGLVertexArrayObject | null = null;
    let buffer: WebGLBuffer | null = null;
    if (gl) {
      const vertexSource = `#version 300 es
        in vec2 a_position;
        in float a_size;
        in float a_alpha;
        in float a_warm;
        uniform float u_pixel_ratio;
        out float v_alpha;
        out float v_warm;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          gl_PointSize = a_size * u_pixel_ratio;
          v_alpha = a_alpha;
          v_warm = a_warm;
        }`;
      const fragmentSource = `#version 300 es
        precision highp float;
        in float v_alpha;
        in float v_warm;
        out vec4 outColor;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
          float edge = 1.0 - smoothstep(0.72, 1.0, radius);
          vec3 cool = vec3(0.77, 0.87, 0.93);
          vec3 warm = vec3(0.91, 0.62, 0.44);
          outColor = vec4(mix(cool, warm, v_warm), v_alpha * edge);
        }`;
      const compileShader = (
        type: number,
        source: string,
      ): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };
      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      if (vertexShader && fragmentShader) {
        program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vertexShader);
          gl.attachShader(program, fragmentShader);
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program);
            program = null;
          }
        }
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
      }
      if (!program) return;

      const vertices = new Float32Array(
        stars.flatMap((star) => [
          star.x * 2 - 1,
          1 - star.y * 2,
          star.radius * 2,
          star.alpha,
          Number(star.warm),
        ]),
      );
      vertexArray = gl.createVertexArray();
      buffer = gl.createBuffer();
      if (!vertexArray || !buffer) {
        if (vertexArray) gl.deleteVertexArray(vertexArray);
        if (buffer) gl.deleteBuffer(buffer);
        return;
      }

      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
      const attributes = [
        { name: "a_position", size: 2, offset: 0 },
        { name: "a_size", size: 1, offset: 2 },
        { name: "a_alpha", size: 1, offset: 3 },
        { name: "a_warm", size: 1, offset: 4 },
      ];
      for (const attribute of attributes) {
        const location = gl.getAttribLocation(program, attribute.name);
        if (location < 0) continue;
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          attribute.size,
          gl.FLOAT,
          false,
          stride,
          attribute.offset * Float32Array.BYTES_PER_ELEMENT,
        );
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      if (gl && program && vertexArray) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        const pixelRatio = gl.getUniformLocation(program, "u_pixel_ratio");
        if (pixelRatio) gl.uniform1f(pixelRatio, ratio);
        gl.bindVertexArray(vertexArray);
        gl.drawArrays(gl.POINTS, 0, stars.length);
      } else if (context) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, bounds.width, bounds.height);
        for (const star of stars) {
          context.beginPath();
          context.arc(
            star.x * bounds.width,
            star.y * bounds.height,
            star.radius,
            0,
            Math.PI * 2,
          );
          context.fillStyle = star.warm
            ? `rgba(231, 157, 112, ${star.alpha})`
            : `rgba(196, 221, 237, ${star.alpha})`;
          context.fill();
        }
      }
    };

    draw();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", draw);
    } else {
      observer = new ResizeObserver(draw);
      observer.observe(canvas);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", draw);
      if (gl && vertexArray) gl.deleteVertexArray(vertexArray);
      if (gl && buffer) gl.deleteBuffer(buffer);
      if (gl && program) gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="sky-viewport" aria-label="Synthetic starfield preview">
      <div className="sky-nebula sky-nebula-one" />
      <div className="sky-nebula sky-nebula-two" />
      <svg
        className="coordinate-grid"
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M500 0 C416 190 416 430 500 620" />
        <path d="M500 0 C584 190 584 430 500 620" />
        <path d="M0 310 C270 264 730 264 1000 310" />
        <path d="M0 150 C270 123 730 123 1000 150" />
        <path d="M0 470 C270 497 730 497 1000 470" />
      </svg>
      <canvas
        ref={canvasRef}
        className="star-canvas"
        aria-hidden="true"
        data-renderer="webgl2-with-2d-fallback"
      />
      <div className="sky-axis sky-axis-top">+90°</div>
      <div className="sky-axis sky-axis-bottom">−90°</div>
      <div className="sky-axis sky-axis-left">+180°</div>
      <div className="sky-axis sky-axis-right">0°</div>
      <div className="field-marker" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="field-label">
        <span className="field-label-dot" />
        <span>SIMULATED FIELD</span>
        <span className="field-label-divider">/</span>
        <span>NOT SPHEREx DATA</span>
      </div>
      <div className="viewport-scale" aria-hidden="true">
        <span />
        5°
      </div>
    </div>
  );
}
