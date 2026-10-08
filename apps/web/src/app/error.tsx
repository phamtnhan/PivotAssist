"use client";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="max-w-[640px] mx-auto px-6 py-16">
      <h1 className="text-xl font-[450] text-[#121317]">Không tải được trang</h1>
      <p className="mt-2 text-[13px] text-[#45474D]">
        Hãy thử lại. Nếu lỗi lặp lại, quay về trang chủ.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-5 rounded-full bg-[#121317] px-4 py-2 text-[13px] text-white"
      >
        Thử lại
      </button>
    </main>
  );
}
