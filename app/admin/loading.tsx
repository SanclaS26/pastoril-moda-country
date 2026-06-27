import PastorilLoading from '../components/ui/PastorilLoading';

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-160px)] max-w-7xl items-center justify-center px-5 py-6 sm:px-8 lg:py-8">
      <PastorilLoading layout="contained" message="Carregando o painel administrativo..." scope="admin" />
    </div>
  );
}