import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, Trash2, Users, Mail, Phone } from "lucide-react";
import { db } from "@/lib/db";
import type { Client } from "@/types";
import { ConfirmDialog } from "./ui";

export function ClientList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>(() => db.getClients());
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = (id: number) => {
    db.deleteClient(id);
    setClients(db.getClients());
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Clientes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} registrado{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          to="/clients/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(`/clients/${c.id}`)}
            className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {c.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <Mail className="w-3 h-3" />
                        {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </span>
                    )}
                    {!c.email && !c.phone && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                  className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
            <Users className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">
              {clients.length === 0 ? "No hay clientes aún" : "Sin resultados"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {clients.length === 0 ? "Crea tu primer cliente para empezar" : "Intenta con otro término de búsqueda"}
            </p>
            {clients.length === 0 && (
              <Link
                to="/clients/new"
                className="mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                Crear primer cliente
              </Link>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar cliente"
        message="¿Eliminar este cliente y todos sus datos? Esta acción no se puede deshacer."
        onConfirm={() => deleteId !== null && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
