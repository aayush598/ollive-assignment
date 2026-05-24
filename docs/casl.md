# CASL Authorization Guide

CASL provides role-based (RBAC) and attribute-based (ABAC) authorization.

## Roles

| Role    | Description                                                                                  |
| ------- | -------------------------------------------------------------------------------------------- |
| `user`  | Default role. Can CRUD own conversations/messages, read own inference logs, read own profile |
| `admin` | Full manage access to all subjects                                                           |

## Ability Definition

Defined in `src/lib/auth/abilities.ts` using CASL's `AbilityBuilder`:

### User abilities

- `manage` Conversation where `userId === currentUser.id`
- `manage` Message where `userId === currentUser.id`
- `read` InferenceLog where `userId === currentUser.id`
- `read` + `update` User where `id === currentUser.id`
- `read` Analytics
- `read` ErrorEvent
- Cannot `delete` User
- Cannot `manage` ErrorEvent

### Admin abilities

- `manage` all subjects

## Usage

```typescript
import { definePermissionsFor, authorize } from "@/lib/auth/abilities";

const ability = definePermissionsFor({ userId: "abc", role: "user" });
authorize(ability, "read", "Conversation");

// With field check
// Only passes if the conversation belongs to the user
const conversation = { userId: "abc" };
authorize(ability, "read", "Conversation"); // The CASL rule filters by userId automatically
```

## Subjects

- `Conversation`
- `Message`
- `InferenceLog`
- `User`
- `Analytics`
- `ErrorEvent`
- `all`

## Actions

- `create`
- `read`
- `update`
- `delete`
- `manage` (all actions)
