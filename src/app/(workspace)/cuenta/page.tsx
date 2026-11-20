import { AccountPrivacy } from "@/components/AccountPrivacy";
import { BrandSettings } from "@/components/BrandSettings";

export const metadata = { title: "Mi cuenta" };

export default function AccountPage() {
  return (
    <div className="care-page">
      <header className="care-heading">
        <div>
          <p className="df-eyebrow">PERFIL</p>
          <h1>Mi cuenta</h1>
          <p className="df-muted">Personaliza tu marca blanca, consulta tu consentimiento o administra tus datos.</p>
        </div>
      </header>
      <BrandSettings />
      <AccountPrivacy context="coach" />
    </div>
  );
}
