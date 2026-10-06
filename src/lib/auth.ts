import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const secretString = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !secretString) {
  console.warn("CRITICAL: SESSION_SECRET is not set in production!");
}
const SECRET_KEY = new TextEncoder().encode(secretString || "default_secret_key_change_in_production");

type SessionPayload = {
  type: "customer" | "admin";
  id: string; // Database ID
  identifier: string; // Customer ID or Admin Email
  role?: string; // For admins
};

export async function createSession(payload: SessionPayload) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(SECRET_KEY);

  const cookieStore = await cookies();
  cookieStore.set("lmx8_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expires,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("lmx8_session")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("lmx8_session");
}

export async function getCurrentCustomer() {
  const session = await getSession();
  if (!session || session.type !== "customer") return null;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: session.id },
    });
    return customer;
  } catch {
    return null;
  }
}

export async function getCurrentAdmin() {
  const session = await getSession();
  if (!session || session.type !== "admin") return null;

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.id },
    });
    return admin;
  } catch {
    return null;
  }
}

export async function requireCustomerSession() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/login");
  }
  return customer;
}

export async function requireAdminSession() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Unauthorized");
  if (admin.role !== "ADMIN" && admin.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: Administrator access required");
  }
  return admin;
}

export async function requireRole(allowedRoles: string[]) {
  const admin = await requireAdminSession();
  if (!allowedRoles.includes(admin.role)) {
    throw new Error("Forbidden");
  }
  return admin;
}
