export default function RootLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="max-w-[640px] mx-auto px-6 py-16 text-[14px] text-[#45474D]"
      aria-busy="true"
      aria-live="polite"
    >
      Đang tải trang…
    </main>
  );
}
