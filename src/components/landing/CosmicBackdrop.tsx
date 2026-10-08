// خلفية كونية ثابتة خلف كامل الصفحة: توهجات بنفسجية/فضية هادئة + نجوم خفيفة.
"use client";

export function CosmicBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07091a]">
      <div className="absolute -top-40 start-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#6f86ff]/20 blur-[140px]" />
      <div className="absolute bottom-0 end-0 h-[420px] w-[420px] rounded-full bg-[#8fa8ff]/10 blur-[160px]" />
      <div className="absolute top-1/3 start-0 h-[320px] w-[320px] rounded-full bg-[#c3cdf0]/10 blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20px 30px, white, transparent), radial-gradient(1px 1px at 120px 80px, white, transparent), radial-gradient(1.5px 1.5px at 200px 150px, white, transparent), radial-gradient(1px 1px at 300px 40px, white, transparent)",
          backgroundSize: "340px 220px",
        }}
      />
    </div>
  );
}