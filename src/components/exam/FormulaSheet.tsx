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
        {/* Faithful reproduction of the official Digital SAT reference sheet —
            only the facts the real exam provides, no invented formulas. */}
        <div className="space-y-6 text-sm text-slate-700">
          <Section title="Area & Circumference">
            <li>Circle area: <em>A = πr²</em></li>
            <li>Circle circumference: <em>C = 2πr</em></li>
            <li>Rectangle area: <em>A = lw</em></li>
            <li>Triangle area: <em>A = ½bh</em></li>
          </Section>
          <Section title="Volume">
            <li>Rectangular solid: <em>V = lwh</em></li>
            <li>Cylinder: <em>V = πr²h</em></li>
            <li>Sphere: <em>V = 4/3 · πr³</em></li>
            <li>Cone: <em>V = 1/3 · πr²h</em></li>
            <li>Pyramid: <em>V = 1/3 · lwh</em></li>
          </Section>
          <Plain title="Pythagorean Theorem"><em>c² = a² + b²</em></Plain>
          <Plain title="Special Right Triangles">
            30°-60°-90° → sides <em>x, x√3, 2x</em> · 45°-45°-90° → sides <em>s, s, s√2</em>
          </Plain>
          <Plain title="Circle & Triangle Facts">
            A circle has 360° (2π radians) of arc. The angle measures of a triangle sum to 180°.
          </Plain>
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
