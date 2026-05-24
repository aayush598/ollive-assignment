// CASL-based authorization (RBAC/ABAC)
import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

export type Action = "create" | "read" | "update" | "delete" | "manage";

// Using string subjects with conditions requires type assertion
// since CASL's generic doesn't infer shapes for plain strings
type Conditions = Record<string, unknown>;

export type AppAbility = MongoAbility<[Action, string], Conditions>;

export const userRoles = ["user", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

interface DefinePermissionsParams {
  userId: string;
  role: UserRole;
}

export function definePermissionsFor(params: DefinePermissionsParams): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const { userId, role } = params;

  if (role === "admin") {
    can("manage", "all");
  } else {
    can("manage", "Conversation", { userId });
    can("manage", "Message", { userId });
    can("read", "InferenceLog", { userId });
    can("read", "User", { id: userId });
    can("update", "User", { id: userId });
    can("read", "Analytics");
    can("read", "ErrorEvent");

    cannot("delete", "User");
    cannot("manage", "ErrorEvent");
  }

  return build();
}

export function getRoleFromUser(user: { id: string; email: string }): UserRole {
  if (user.email === "admin@example.com") {
    return "admin";
  }
  return "user";
}

export function authorize(ability: AppAbility, action: Action, subject: string) {
  if (!ability.can(action, subject)) {
    const error = new Error("Forbidden");
    error.name = "ForbiddenError";
    throw error;
  }
}

export function authorizeWithField(
  ability: AppAbility,
  action: Action,
  subject: string,
  field: string,
) {
  if (!ability.can(action, subject, field)) {
    const error = new Error("Forbidden");
    error.name = "ForbiddenError";
    throw error;
  }
}
