import type { Metadata } from "next";
import Link from "next/link";
import { Leaf, ShieldCheck } from "lucide-react";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_NOTICE_EFFECTIVE_DATE,
  PRIVACY_NOTICE_VERSION,
} from "@/lib/privacy";
import { PrivacyDeletedNotice } from "@/components/PrivacyDeletedNotice";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Qué datos personales trata DietForge, para qué, cuánto tiempo y cómo ejercer tus derechos ARCO.",
};

const effective = new Date(`${PRIVACY_NOTICE_EFFECTIVE_DATE}T12:00:00Z`);
const effectiveLabel = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(effective);

const dataGroups = [
  {
    title: "Cuenta del coach y del cliente",
    detail:
      "Correo electrónico, contraseña cifrada por Supabase Auth, rol (coach o administrador), fecha de alta, consentimiento del aviso de privacidad y estado de acceso o vigencia del servicio.",
  },
  {
    title: "Clientes del coach",
    detail:
      "Nombre o identificador del expediente, correo u otro contacto que el coach registre, fecha de nacimiento o edad, sexo, estatura y datos de seguimiento: peso, grasa corporal, medidas, hábitos, notas y adherencia.",
  },
  {
    title: "Datos de salud",
    detail:
      "Peso, composición corporal, medidas, fotografías de progreso, condiciones reportadas, molestias y evolución de la dieta. Son datos personales sensibles y se tratan solo para el seguimiento nutricional y de entrenamiento que el coach presta.",
  },
  {
    title: "Dietas y entrenamiento",
    detail:
      "Planes de comidas, alimentos, cantidades, macros, Rest Day, ciclos, Peak Week, rutinas, series, cargas, repeticiones, sesiones y check-ins que el coach o el cliente registran.",
  },
  {
    title: "Pagos y acceso comercial",
    detail:
      "Periodo contratado, fecha de vencimiento, notas de renovación, identificadores de cliente y suscripción de Stripe. DietForge no guarda números de tarjeta: los procesa Stripe.",
  },
  {
    title: "Datos técnicos mínimos",
    detail:
      "Registros de errores de la sesión en el navegador, preferencia de tema y el correo visible en el dispositivo. No usamos rastreo publicitario ni cookies de terceros.",
  },
];

const sections = [
  {
    title: "1. Responsable del tratamiento",
    body: (
      <>
        <p>
          <strong>DietForge</strong> es el responsable de los datos personales descritos en este aviso. Su domicilio
          de contacto es México y el correo para cualquier asunto de privacidad es{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
        </p>
        <p>
          Este aviso es integral, en español, y se rige por la Ley Federal de Protección de Datos Personales en
          Posesión de los Particulares (LFPDPPP), su Reglamento y los Lineamientos del INAI.
        </p>
      </>
    ),
  },
  {
    title: "2. Qué datos tratamos",
    body: (
      <>
        <p>Tratamos únicamente los datos necesarios para operar la plataforma:</p>
        <ul className="privacy-list">
          {dataGroups.map((group) => (
            <li key={group.title}>
              <strong>{group.title}.</strong> {group.detail}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    title: "3. Para qué usamos tus datos",
    body: (
      <>
        <p id="finalidades">Finalidades primarias, necesarias para el servicio:</p>
        <ul className="privacy-list">
          <li>Crear y mantener tu cuenta, autenticarte y verificar la vigencia de tu acceso.</li>
          <li>Permitir al coach administrar clientes, dietas, rutinas y seguimiento.</li>
          <li>Entregar al cliente su portal con dieta, entrenamiento y check-ins autorizados.</li>
          <li>Calcular macros, volumen, adherencia y reportes que el propio coach solicita.</li>
          <li>Cobrar, renovar o suspender el servicio y llevar la bitácora administrativa.</li>
          <li>Proteger la plataforma: auditabilidad, prevención de accesos indebidos y respaldos.</li>
          <li>Atender solicitudes de derechos ARCO, exportación o eliminación de datos.</li>
        </ul>
        <p>
          <strong>No usamos tus datos para publicidad ni creamos perfiles comerciales.</strong> Cualquier finalidad
          distinta requiere tu consentimiento previo y puede rechazarse sin afectar el servicio.
        </p>
      </>
    ),
  },
  {
    title: "4. Datos sensibles y consentimiento expreso",
    body: (
      <>
        <p>
          Los datos de salud solo se capturan con la finalidad de seguimiento nutricional y de entrenamiento. Al
          registrar a un cliente, el coach confirma que cuenta con la autorización de esa persona para capturar y
          tratar su información de salud. El cliente puede consultar, descargar o solicitar la corrección de su
          información mediante su coach o directamente por correo.
        </p>
        <p>
          Sin el consentimiento expreso no se crea la cuenta del portal y no se registra información de salud nueva.
        </p>
      </>
    ),
  },
  {
    title: "5. Cuánto tiempo conservamos los datos",
    body: (
      <>
        <ul className="privacy-list">
          <li>
            <strong>Cuenta y expedientes:</strong> mientras el servicio esté activo y hasta <strong>5 años</strong>{" "}
            después del último registro, como referencia de conservación de expedientes de salud (NOM-004-SSA3-2012).
          </li>
          <li>
            <strong>Respaldos:</strong> se conservan las 100 capturas más recientes del espacio de trabajo; al
            eliminar la cuenta se purgan también esas capturas.
          </li>
          <li>
            <strong>Pagos y comprobantes:</strong> el plazo que exijan las obligaciones fiscales y contables
            aplicables.
          </li>
          <li>
            <strong>Bitácora de privacidad:</strong> correo, fecha y tipo de solicitud (exportación o eliminación)
            hasta 5 años, como evidencia de cumplimiento.
          </li>
        </ul>
        <p>Al terminar el plazo se elimina o anonimiza la información de forma irreversible.</p>
      </>
    ),
  },
  {
    title: "6. Quién puede ver tus datos",
    body: (
      <>
        <ul className="privacy-list">
          <li>
            <strong>Tu coach asignado:</strong> accede solo a los expedientes de su propio espacio de trabajo.
          </li>
          <li>
            <strong>Cliente del portal:</strong> accede únicamente a su expediente cuando el coach autoriza su correo
            verificado.
          </li>
          <li>
            <strong>Administrador de DietForge:</strong> gestiona accesos, renovaciones y soporte; no usa la
            información clínica para otros fines.
          </li>
          <li>
            <strong>Encargados de infraestructura:</strong> Supabase (base de datos, autenticación y archivos),
            Vercel (alojamiento) y Stripe (pagos). Actúan por instrucción nuestra y bajo obligaciones de
            confidencialidad.
          </li>
        </ul>
        <p>No vendemos, rentamos ni compartimos tus datos con terceros para fines propios.</p>
      </>
    ),
  },
  {
    title: "7. Transferencias",
    body: (
      <p>
        No realizamos transferencias que requieran tu consentimiento. Solo se atienden las excepciones previstas en
        el artículo 37 de la LFPDPPP (por ejemplo, requerimientos de autoridad competente debidamente fundados) y las
        necesarias para prestar el servicio con los encargados listados.
      </p>
    ),
  },
  {
    title: "8. Tus derechos ARCO",
    body: (
      <>
        <p>En todo momento puedes ejercer:</p>
        <ul className="privacy-list">
          <li>
            <strong>Acceso:</strong> conocer qué datos tenemos y obtener una copia en formato JSON.
          </li>
          <li>
            <strong>Rectificación:</strong> corregir datos inexactos o incompletos.
          </li>
          <li>
            <strong>Cancelación:</strong> solicitar la eliminación de tus datos personales.
          </li>
          <li>
            <strong>Oposición:</strong> oponerte a una finalidad concreta; el servicio seguirá funcionando para las
            finalidades primarias.
          </li>
        </ul>
        <p>
          <strong>Cómo ejercerlos:</strong> escribe a{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a> indicando tu nombre, correo de la
          cuenta y el derecho que deseas ejercer. También puedes hacerlo desde la plataforma:{" "}
          <strong>Mi cuenta → Exportar mis datos</strong> y <strong>Eliminar mi cuenta</strong>, con confirmación
          doble.
        </p>
        <p>
          Responderemos en un máximo de <strong>20 días hábiles</strong>, prorrogables por 10 días hábiles más si es
          necesario, y aplicaremos la solicitud en los 15 días hábiles siguientes cuando proceda. La atención es
          gratuita; solo se cobrarían costos de envío si se pide otro medio.
        </p>
        <p>
          Si consideras que no atendimos tu solicitud, puedes acudir al Instituto Nacional de Transparencia, Acceso a
          la Información y Protección de Datos Personales (INAI).
        </p>
      </>
    ),
  },
  {
    title: "9. Exportación y eliminación",
    body: (
      <>
        <p>
          <strong>Exportar</strong> descarga un archivo JSON con tu cuenta, consentimiento, clientes, dietas,
          mediciones, check-ins, rutinas y actividad registrada, junto con la fecha de la solicitud.
        </p>
        <p>
          <strong>Eliminar mi cuenta</strong> borra el espacio de trabajo, sus registros, los respaldos y capturas
          del snapshot, el consentimiento, el acceso y la cuenta de autenticación. Los videos privados del coach
          también se retiran del almacenamiento. La solicitud queda en la bitácora de privacidad.
        </p>
        <p>
          En el caso de un cliente del portal, la eliminación retira su acceso al portal y su cuenta de
          autenticación; el expediente clínico permanece bajo responsabilidad y conservación del coach, conforme al
          punto 5.
        </p>
      </>
    ),
  },
  {
    title: "10. Seguridad",
    body: (
      <p>
        Aplicamos aislamiento por identidad en la base de datos (RLS y funciones con verificación de propietario),
        contraseñas cifradas, conexiones HTTPS, videos privados y respaldo previo a cada guardado. Ningún sistema es
        infalible: si ocurre un incidente que afecte tus datos, se te informará sin dilación por el correo registrado.
      </p>
    ),
  },
  {
    title: "11. Cookies y almacenamiento local",
    body: (
      <p>
        Usamos almacenamiento local del navegador para mantener la sesión, recordar el tema claro u oscuro y mostrar
        tu correo en la pantalla de acceso. No hay cookies publicitarias ni seguimiento entre sitios.
      </p>
    ),
  },
  {
    title: "12. Menores de edad",
    body: (
      <p>
        El servicio está dirigido a profesionales y a personas mayores de edad. Si se registra información de un
        menor, el coach debe contar con la autorización de quien ejerza la patria potestad o tutela.
      </p>
    ),
  },
  {
    title: "13. Cambios al aviso",
    body: (
      <p>
        Cualquier cambio se publica en esta misma página con una nueva versión y fecha de entrada en vigor. Los
        cambios sustanciales se avisan en la plataforma y, cuando impliquen nuevas finalidades, se solicita un nuevo
        consentimiento antes de aplicarlas.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-page">
      <article aria-labelledby="privacy-title">
        <header className="privacy-header">
          <Link href="/" className="df-wordmark" aria-label="Volver a DietForge">
            <span className="df-logo"><Leaf size={21} /></span>DietForge
          </Link>
          <p className="df-eyebrow">AVISO DE PRIVACIDAD</p>
          <h1 id="privacy-title">Aviso de privacidad integral</h1>
          <p className="privacy-meta">
            Versión <strong>{PRIVACY_NOTICE_VERSION}</strong> · Vigente desde el <strong>{effectiveLabel}</strong>
          </p>
          <p className="privacy-lead">
            Este aviso explica qué datos personales guarda DietForge, para qué los usa, cuánto tiempo los conserva,
            quién puede verlos y cómo puedes acceder, corregir, exportar o eliminar tu información.
          </p>
          <p className="privacy-badge"><ShieldCheck size={16} /> Conforme a la LFPDPPP (México)</p>
          <PrivacyDeletedNotice />
        </header>

        <nav aria-label="Contenido del aviso" className="privacy-toc">
          {sections.map((section) => (
            <a key={section.title} href={`#${slug(section.title)}`}>{section.title}</a>
          ))}
        </nav>

        {sections.map((section) => (
          <section key={section.title} id={slug(section.title)} className="privacy-section">
            <h2>{section.title}</h2>
            {section.body}
          </section>
        ))}

        <footer className="privacy-footer">
          <p>
            Contacto de privacidad: <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
          </p>
          <p>
            Versión {PRIVACY_NOTICE_VERSION} · {PRIVACY_NOTICE_EFFECTIVE_DATE}
          </p>
          <p><Link href="/">Volver al inicio</Link></p>
        </footer>
      </article>
    </div>
  );
}

function slug(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
