'use client';
import Button from '@/components/ui/Button';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#060b09] text-[#eff8f3]">
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
          <section className="w-full max-w-xl rounded-[2rem] border border-[#173e33] bg-[#071914] p-8 text-center shadow-2xl sm:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#eb6a38]">KAINARA recovery</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              The application needs a fresh start.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#8ea99f]">
              Reload the interface to continue. No meal or profile change was submitted by this screen.
            </p>
            <Button className="mt-8 bg-[#eb6a38]" onClick={reset} type="button">
              Reload KAINARA
            </Button>
          </section>
        </main>
      </body>
    </html>
  );
}
