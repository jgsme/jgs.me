import { usePageContext } from "vike-react/usePageContext";

export default function Page() {
  const { is404 } = usePageContext();

  return (
    <p className="text-fg-muted">
      {is404 ? "この画像は無い" : "エラーが起きた"}
    </p>
  );
}
