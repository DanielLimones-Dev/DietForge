import { AccountPrivacy } from "@/components/AccountPrivacy";

export const metadata = { title: "Mi cuenta" };

export default function AccountPage() {
  return (
    <div className="care-page">
      <header className="care-heading">
        <div>
          <p className="df-eyebrow">PERFIL</p>
          <h1>Mi cuenta</h1>
          <p className="df-muted">Consulta tu consentimiento, exporta tu información o elimina tu cuenta.</p>
        </div>
      </header>
      <AccountPrivacy context="coach" />
    </div>
  );
}
