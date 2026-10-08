export default function FrozenPage() {
    return (
      <div className="container-x py-20 text-center">
        <div className="mx-auto max-w-md rounded-2xl border p-8 shadow-sm bg-card">
          <span className="text-4xl">❄️</span>
          <h1 className="mt-4 text-2xl font-black">هذا المتجر متوقف مؤقتاً</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            انتهت فترة التجربة المجانية لهذا المتجر بانتظار تفعيله من قبل التاجر.
          </p>
        </div>
      </div>
    );
  }