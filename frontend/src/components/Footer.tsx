import logo from "../../public/MSHCL_Black.svg";

export function Footer() {
  return (
    <footer className="grid w-full grid-cols-3 items-center p-5 text-xs">
      <span className="opacity-50">offline library for reading manga.</span>
      <img
        src={logo}
        alt="logo"
        className="mx-auto w-20 dark:invert"
      />
      <span className="text-right opacity-50">made with luv by open-source-community</span>
    </footer>
  );
}
