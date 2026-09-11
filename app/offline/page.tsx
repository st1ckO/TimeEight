import { Clock3, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <a className="brand" href="/today">
        <span>8</span>
        <strong>TimeEight</strong>
      </a>
      <section>
        <WifiOff size={34} />
        <p className="eyebrow">You are offline</p>
        <h1>Your local timers are still yours.</h1>
        <p>
          Open a previously visited screen to use its local data. TimeEight will
          synchronize pending changes after the connection returns.
        </p>
        <a className="primary-button" href="/today">
          <Clock3 size={18} />
          Return to today
        </a>
      </section>
    </main>
  );
}
