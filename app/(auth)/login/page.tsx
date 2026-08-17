import { login } from "../actions";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <form action={login} className="flex flex-col gap-4">
        <input name="email" type="email" placeholder="Email" className="border rounded p-2" required />
        <input name="password" type="password" placeholder="Password" className="border rounded p-2" required />
        <button className="bg-black text-white rounded p-2">Log in</button>
      </form>
    </main>
  );
}
