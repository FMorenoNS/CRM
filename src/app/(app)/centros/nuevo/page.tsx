import { CentroCreateForm } from "../centro-form";

export default function NuevoCentroPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Nuevo centro</h1>
      <div className="mt-6">
        <CentroCreateForm />
      </div>
    </div>
  );
}
