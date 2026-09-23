import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-sm text-gray-600">
          Your Google account is not authorised to access this system. Contact
          the owner to request access.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
