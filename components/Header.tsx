interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="flex items-start justify-between px-8 pt-7 pb-4">
      {/* Page title — red as in Figma */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight" style={{ color: "#CA4A28" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[17px] mt-0.5" style={{ color: "#CA4A28" }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Harga Emas box — white bg with brown border, as in Figma */}
      <div
        className="border-2 rounded-lg px-5 py-3 bg-white"
        style={{ borderColor: "#6F5333" }}
      >
        <p className="text-sm font-medium" style={{ color: "#6F5333" }}>
          Harga emas sekarang
        </p>
        <p className="text-lg font-bold mt-0.5" style={{ color: "#6F5333" }}>
          Rp. 2.800.000 /gram
        </p>
      </div>
    </div>
  );
}
