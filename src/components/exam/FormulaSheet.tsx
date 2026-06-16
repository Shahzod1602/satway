"use client";

import { BookOpen, ChevronRight } from "lucide-react";

/** The SAT Math reference sheet, shown as a slide-over panel. */
export default function FormulaSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-[380px] max-w-[90vw] flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <BookOpen className="h-4 w-4" /> Reference Sheet
        </span>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="exam-scroll flex-1 overflow-y-auto p-6">
        <div className="space-y-6 text-sm text-slate-700">
          <Section title="Area & Volume">
            <li>Circle: <em>A = πr²</em></li>
            <li>Circumference: <em>C = 2πr</em></li>
            <li>Rectangle area: <em>A = lw</em></li>
            <li>Triangle area: <em>A = ½bh</em></li>
            <li>Trapezoid: <em>A = ½(b₁ + b₂)h</em></li>
            <li>Sphere volume: <em>V = ⅓ πr³</em></li>
            <li>Cone volume: <em>V = ⅓ πr²h</em></li>
            <li>Cylinder volume: <em>V = πr²h</em></li>
            <li>Pyramid volume: <em>V = ⅓Bh</em></li>
          </Section>
          <Plain title="Pythagorean Theorem"><em>a² + b² = c²</em></Plain>
          <Plain title="Special Right Triangles">30-60-90 and 45-45-90 side ratios</Plain>
          <Plain title="Quadratic Formula">x = [−b ± √(b² − 4ac)] / 2a</Plain>
          <Plain title="Distance">d = √[(x₂ − x₁)² + (y₂ − y₁)²]</Plain>
          <Plain title="Slope-Intercept">y = mx + b</Plain>
          <Plain title="Circle Equation">(x − h)² + (y − k)² = r²</Plain>
          <Plain title="Degrees & Radians">180° = π radians</Plain>
          <Plain title="Arc & Sector">There are 360° (2π radians) in a circle.</Plain>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold text-slate-900">{title}</h4>
      <ul className="space-y-1 text-slate-600">{children}</ul>
    </div>
  );
}

function Plain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold text-slate-900">{title}</h4>
      <p className="text-slate-600">{children}</p>
    </div>
  );
}
