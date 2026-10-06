"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, clearSession, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { normalizePhoneNumber, getPhoneLookupVariants } from "@/lib/phone";

export async function loginCustomerAction(identifier: string, pin: string, redirectUrl?: string) {
  if (!identifier || !pin) {
    return { error: "Customer ID or Phone Number and PIN are required." };
  }

  if (pin.length < 6 || pin.length > 8 || !/^\d+$/.test(pin)) {
    return { error: "PIN must be between 6 and 8 digits." };
  }

  try {
    const rawId = identifier.trim();
    // Determine if identifier is ID or phone
    const isIdFormat = rawId.toUpperCase().startsWith("LMX8-");

    let customer = null;

    if (isIdFormat) {
      customer = await prisma.customer.findUnique({
        where: { customerIdentifier: rawId.toUpperCase() },
      });
    } else {
      // Find customer by canonical phone or any lookup variant
      const phoneVariants = getPhoneLookupVariants(rawId);
      customer = await prisma.customer.findFirst({
        where: {
          phone: { in: phoneVariants },
        },
      });

      // Fallback: If not found yet, query by normalized suffix match
      if (!customer) {
        let clean = rawId.replace(/[\s\-\+\(\)\.]/g, '');
        if (clean.startsWith('233')) clean = clean.substring(3);
        else if (clean.startsWith('0')) clean = clean.substring(1);
        if (clean.length >= 7) {
          const matchingCustomers = await prisma.customer.findMany({
            where: {
              phone: { contains: clean }
            }
          });
          if (matchingCustomers.length === 1) {
            customer = matchingCustomers[0];
          }
        }
      }
    }

    if (!customer) {
      // Generic error to avoid revealing if a customer exists
      return { error: "Invalid Customer ID/Phone Number or PIN." };
    }

    if (customer.status !== "ACTIVE") {
      return { error: "Account is not active. Please contact support." };
    }

    // Brute force protection check
    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      return { error: "Account is temporarily locked due to too many failed attempts. Please try again later." };
    }

    // Verify PIN
    // If the customer doesn't have a pinHash, they haven't set up their account yet
    if (!customer.pinHash) {
      return { error: "Account setup incomplete. Please contact support." };
    }

    const isMatch = await bcrypt.compare(pin, customer.pinHash);

    if (!isMatch) {
      // Increment login attempts
      const newAttempts = customer.loginAttempts + 1;
      let lockedUntil = null;
      
      if (newAttempts >= 5) {
        // Lock for 15 minutes
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        
        await prisma.auditLog.create({
          data: {
            action: "CUSTOMER_ACCOUNT_LOCKED",
            entityType: "Customer",
            entityId: customer.id,
            description: `Account temporarily locked due to 5 failed login attempts`,
          },
        });
      } else {
        await prisma.auditLog.create({
          data: {
            action: "CUSTOMER_LOGIN_FAILED",
            entityType: "Customer",
            entityId: customer.id,
            description: `Failed PIN attempt ${newAttempts}/5`,
          },
        });
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: { loginAttempts: newAttempts, lockedUntil },
      });

      return { error: "Invalid Customer ID/Phone Number or PIN." };
    }

    // Success! Reset login attempts
    await prisma.customer.update({
      where: { id: customer.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    await prisma.auditLog.create({
      data: {
        action: "CUSTOMER_LOGIN_SUCCESS",
        entityType: "Customer",
        entityId: customer.id,
        description: `Successful login for customer ${customer.customerIdentifier}`,
      },
    });

    await createSession({
      type: "customer",
      id: customer.id,
      identifier: customer.customerIdentifier,
    });
    
  } catch (error) {
    console.error("Login error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
  
  // Need to redirect outside try/catch because redirect throws an internal Next.js error
  const destination = (redirectUrl && redirectUrl.startsWith("/")) ? redirectUrl : "/portal";
  redirect(destination);
}

export async function loginAdminAction(pin: string) {
  if (!pin) {
    return { error: "PIN is required." };
  }
  
  if (pin.length < 6 || pin.length > 8 || !/^\d+$/.test(pin)) {
    return { error: "PIN must be between 6 and 8 digits." };
  }

  try {
    // We expect 1 or few admins. Find all active admins with ADMIN or SUPER_ADMIN roles.
    let admins = await prisma.adminUser.findMany({
      where: { 
        status: "ACTIVE",
        role: { in: ["ADMIN", "SUPER_ADMIN"] }
      },
    });

    const initialPin = process.env.ADMIN_INITIAL_PIN;

    if (admins.length === 0) {
      // First-time setup: Create default admin if ADMIN_INITIAL_PIN is provided and matches
      if (initialPin && initialPin === pin) {
        const pinHash = await bcrypt.hash(initialPin, 10);
        const newAdmin = await prisma.adminUser.create({
          data: {
            name: "LMX8 Administrator",
            email: "admin@lmx8.com",
            pinHash: pinHash,
            role: "SUPER_ADMIN",
            status: "ACTIVE"
          }
        });
        admins = [newAdmin];
      } else {
        return { error: "Invalid credentials." };
      }
    }

    let matchedAdmin = null;

    // Check rate limits first
    for (const admin of admins) {
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        continue; // Skip locked accounts during check
      }
      
      // Auto-migrate legacy admins using ADMIN_INITIAL_PIN if they have no pinHash
      if (!admin.pinHash && initialPin && initialPin === pin) {
        const pinHash = await bcrypt.hash(initialPin, 10);
        await prisma.adminUser.update({
          where: { id: admin.id },
          data: { pinHash }
        });
        admin.pinHash = pinHash;
      }
      
      // If the admin has no pinHash yet (maybe they only have passwordHash), they can't login via PIN
      if (admin.pinHash) {
        const isMatch = await bcrypt.compare(pin, admin.pinHash);
        if (isMatch) {
          matchedAdmin = admin;
          break;
        }
      } else if (admin.passwordHash) {
        // Fallback: If they only have a passwordHash (from before PIN migration), let's allow it temporarily
        // so we don't break existing setups if the admin hasn't reset their PIN yet.
        const isMatch = await bcrypt.compare(pin, admin.passwordHash);
        if (isMatch) {
          matchedAdmin = admin;
          break;
        }
      }
    }

    if (!matchedAdmin) {
      // Find the first admin to increment their failed attempts to prevent brute force
      // Since we don't know WHICH admin they were trying to log in as (just a PIN), 
      // we increment the first active admin's attempt counter to rate limit the global endpoint.
      const targetAdmin = admins[0];
      
      if (targetAdmin) {
        const newAttempts = (targetAdmin.loginAttempts || 0) + 1;
        let lockedUntil = null;
        
        if (newAttempts >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
          await prisma.auditLog.create({
            data: {
              action: "ADMIN_LOGIN_LOCKED",
              entityType: "AdminUser",
              entityId: targetAdmin.id,
              description: `Admin login locked due to 5 failed PIN attempts`,
              adminId: targetAdmin.id,
            },
          });
        } else {
          await prisma.auditLog.create({
            data: {
              action: "ADMIN_LOGIN_FAILED",
              entityType: "System",
              entityId: "AUTH",
              description: `Failed admin PIN login attempt`,
            },
          });
        }
        
        await prisma.adminUser.update({
          where: { id: targetAdmin.id },
          data: { loginAttempts: newAttempts, lockedUntil }
        });
      }
      
      return { error: "Invalid administrator PIN." };
    }

    // Reset login attempts on success
    await prisma.adminUser.update({
      where: { id: matchedAdmin.id },
      data: { loginAttempts: 0, lockedUntil: null }
    });

    await prisma.auditLog.create({
      data: {
        action: "ADMIN_LOGIN_SUCCESS",
        entityType: "AdminUser",
        entityId: matchedAdmin.id,
        description: `Successful PIN login for admin ${matchedAdmin.email}`,
        adminId: matchedAdmin.id,
      },
    });

    await createSession({
      type: "admin",
      id: matchedAdmin.id,
      identifier: matchedAdmin.email,
      role: matchedAdmin.role,
    });

  } catch (error) {
    console.error("Admin login error:", error);
    return { error: "An unexpected error occurred." };
  }

  redirect("/admin");
}

export async function logoutAction(redirectTo: string = "/login") {
  try {
    const session = await getSession();
    
    if (session) {
      if (session.type === "customer") {
        await prisma.auditLog.create({
          data: {
            action: "CUSTOMER_LOGOUT",
            entityType: "Customer",
            entityId: session.id,
            description: `Customer logged out`,
          },
        });
      } else if (session.type === "admin") {
        await prisma.auditLog.create({
          data: {
            action: "ADMIN_LOGOUT",
            entityType: "AdminUser",
            entityId: session.id,
            description: `Admin logged out`,
            adminId: session.id,
          },
        });
      }
    }
  } catch (err) {
    console.error("Error logging logout:", err);
  }

  await clearSession();
  redirect(redirectTo);
}
