import { signup } from "../actions";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
      <form action={signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>I am a…</span>
          <select name="role" className="border rounded p-2" defaultValue="creator">
            <option value="creator">Video creator</option>
            <option value="brand">Brand</option>
          </select>
        </label>
        <input name="display_name" placeholder="Display name" className="border rounded p-2" required />
        <input name="email" type="email" placeholder="Email" className="border rounded p-2" required />
        <input name="password" type="password" placeholder="Password" minLength={8} className="border rounded p-2" required />
        <button className="bg-black text-white rounded p-2">Sign up</button>
      </form>
    </main>
  );
}
