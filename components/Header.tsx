interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        {subtitle && <p className="text-gray-500 text-base mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-base text-gray-500">{dateStr}</p>
          <div className="flex items-center gap-2 justify-end mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8860B] inline-block"></span>
            <span className="text-base font-semibold text-[#B8860B]">Harga Emas: Rp 2.800.000/gram</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-[#B8860B] flex items-center justify-center text-white font-bold text-xl">
          A
        </div>
      </div>
    </header>
  );
}
