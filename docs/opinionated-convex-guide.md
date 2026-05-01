# Convex guidelines

## Function guidelines

### New function syntax

- ALWAYS use the new function syntax for Convex functions. For example:

  ```ts
  import { query } from "./_generated/server";
  import { v } from "convex/values";
  export const f = query({
      args: {},
      returns: v.null(),
      handler: async (ctx, args) => {
      // Function body
      },
  });
  ```

### Http endpoint syntax
- HTTP endpoints are defined in `convex/http.ts` and require an `httpAction` decorator. For example:

  ```ts
  import { httpRouter } from "convex/server";
  import { httpAction } from "./_generated/server";
  const http = httpRouter();
  http.route({
      path: "/echo",
      method: "POST",
      handler: httpAction(async (ctx, req) => {
      const body = await req.bytes();
      return new Response(body, { status: 200 });
      }),
  });
  ```

- HTTP endpoints register exactly at the path given in the `path` field.  
  EXAMPLE: `/api/someRoute` registers at `/api/someRoute`.

### Function Registration
- Use `internalQuery`, `internalMutation`, and `internalAction` for private functions (imported from `./_generated/server`), callable only by other Convex functions.
- Use `query`, `mutation`, and `action` for public API functions. DO NOT USE these for sensitive internal functions.
- You cannot register functions via the `api` or `internal` objects.
- ALWAYS INCLUDE ARGUMENT AND RETURN VALIDATORS. If a function returns nothing, specify `returns: v.null()`.
- A Convex function without an explicit return value implicitly returns `null`.

### Function Calling
- Use `ctx.runQuery` to call a query from a query, mutation, or action.
- Use `ctx.runMutation` to call a mutation from a mutation or action.
- Use `ctx.runAction` to call an action from an action.
- Only call an action from another action to cross runtimes (e.g. V8 to Node); otherwise, factor shared code into an async helper.
- Minimize action-to-query/mutation calls to avoid race conditions from splitting transactional logic.
- All calls require a `FunctionReference`—DO NOT PASS THE CALLEEE FUNCTION DIRECTLY.
- When calling a function in the same file with `ctx.runQuery`, `ctx.runMutation`, or `ctx.runAction`, add a type annotation on the return value to work around TypeScript circularity. For example:
                           
  ```ts
  export const f = query({
    args: { name: v.string() },
    returns: v.string(),
    handler: async (ctx, args) => {
      return "Hello " + args.name;
    },
  });

  export const g = query({
    args: {},
    returns: v.null(),
    handler: async (ctx, args) => {
      const result: string = await ctx.runQuery(api.example.f, { name: "Bob" });
      return null;
    },
  });
  ```

### Function References
- Function references point to registered Convex functions.
- Use the `api` object (from `convex/_generated/api.ts`) to call public functions defined with `query`, `mutation`, or `action`.
- Use the `internal` object (from `convex/_generated/api.ts`) to call private functions defined with `internalQuery`, `internalMutation`, or `internalAction`.
- With file-based routing:
  - A public function `f` in `convex/example.ts` is referenced as `api.example.f`.
  - A private function `g` in `convex/example.ts` is referenced as `internal.example.g`.
  - A public function `h` in `convex/messages/access.ts` is referenced as `api.messages.access.h`.

### API Design
- Organize public functions within the `convex/` directory using file-based routing.
- Define public functions with `query`, `mutation`, and `action`.
- Define private functions with `internalQuery`, `internalMutation`, and `internalAction`.

### Pagination
- Paginated queries return results in incremental pages.
- Define pagination using the following syntax:

  ```ts
  import { v } from "convex/values";
  import { query, mutation } from "./_generated/server";
  import { paginationOptsValidator } from "convex/server";
  export const listWithExtraArg = query({
    args: { paginationOpts: paginationOptsValidator, author: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
        .query("messages")
        .filter((q) => q.eq(q.field("author"), args.author))
        .order("desc")
        .paginate(args.paginationOpts);
    },
  });
  ```

- A query ending with `.paginate()` returns an object with:
  - `page` an array of documents.
  - `isDone` a boolean indicating the last page.
  - `continueCursor` a string cursor for fetching the next page.

## Validator Guidelines
- Use `v.int64()` for signed 64-bit integers (replacing the deprecated `v.bigint()`).
- Define record types with `v.record()`; `v.map()` and `v.set()` are NOT SUPPORTED.

## Convex Schema Guidelines
- Define your schema in `convex/schema.ts`.
- Import schema functions (e.g. `defineTable`) from `convex/server`.
- Create validator fragments in dedicated files (e.g. `apps/app/convex/memberships/validators.ts`) to encapsulate and reuse validation logic.

  ```ts:convex/memberships/validators.ts
  export const teamRole = v.optional(
    v.union(v.literal('member'), v.literal('admin'), v.literal('owner')),
  );

  export const membershipsFields = {
    role: v.optional(teamRole),
    accepted: v.optional(v.boolean()),
    teamId: v.optional(v.id('teams')),
    userId: v.optional(v.id('users')),
  };
  ```

- Import and use your validator fragments in the schema definition. E.g.:

  ```ts:convex/schema.ts
  import { defineTable } from 'convex/server';
  import { membershipsFields } from '#cvx/memberships/validators';

  export const membershipsTable = defineTable(membershipsFields)
    .index('by_team', ['teamId'])
    .index('by_user', ['userId'])
    .index('by_team_user', ['teamId', 'userId'])
    .index('by_team_role', ['teamId', 'role']);
  ```

### Schema Fields
- All documents include system fields prefixed with an underscore (e.g. `_id`, `_creationTime`).
  - `_id` is the primary key with a built-in index.
  - Use `_id` for lookups rather than other fields (like email).

## TypeScript Guidelines
- Use the helper type `Id` from `'./_generated/dataModel'` to type document ids. For example, for a `users` table, use `Id<'users'>`.
- When defining a record, explicitly provide key and value types. For example, `v.record(v.id('users'), v.string())` corresponds to `Record<Id<'users'>, string>`.
- BE STRICT WITH TYPES—functions expecting a user id should accept `Id<'users'>` rather than a plain `string`.

## Full Text Search Guidelines
- To query "10 messages in channel '#general' that best match the query 'hello hi'" in their body, structure the query accordingly:

  ```ts
  const messages = await ctx.db
    .query("messages")
    .withSearchIndex("search_body", (q) =>
      q.search("body", "hello hi").eq("channel", "#general"),
    )
    .take(10);
  ```

## Query Guidelines
- AVOID `filter`. Instead, define an index in the schema and use `withIndex`.
- NO `.delete()`. Use `.collect()` to retrieve results, then iterate and call `ctx.db.delete(row._id)` on each.
- USE `.unique()`. Retrieves a single document and throws an error if multiple match.

### Ordering
- Documents default to ascending `_creationTime`.
- Specify order with `.order('asc')` or `.order('desc')` (defaults to ascending).
- Indexed queries order by the index columns, avoiding slow table scans.

## Mutation Guidelines
- Use `ctx.db.replace` to fully replace a document (throws an error if it doesn't exist).
- Use `ctx.db.patch` to merge updates into a document (throws an error if it doesn't exist).

## Scheduling Guidelines

### Cron Guidelines
- Use only `crons.interval` or `crons.cron` for scheduling (avoid `crons.hourly`, `crons.daily`, and `crons.weekly`).
- Both methods require a FunctionReference; do not pass the function directly.
- Define crons by declaring a top-level `crons` object, invoking its methods, and exporting it as default. For example,
  
  ```ts
  import { cronJobs } from "convex/server";
  import { internal } from "./_generated/api";
  import { internalAction } from "./_generated/server";

  const empty = internalAction({
    args: {},
    handler: async (ctx, args) => {
      console.log("empty");
    },
  });

  const crons = cronJobs();

  // Run `internal.crons.empty` every two hours.
  crons.interval("delete inactive users", { hours: 2 }, internal.crons.empty, {});

  export default crons;
  ```

- Register Convex functions in `crons.ts` like any other file.
- If a cron calls an internal function, ALWAYS import the `internal` object from `_generated/api` (even if the function is defined in the same file).

## FILE STORAGE GUIDELINES
- Convex supports file storage for large files (images, videos, PDFs).
- `ctx.storage.getUrl()` returns a signed URL for a file, or `null` if it doesn't exist.
- DO NOT USE the deprecated `ctx.storage.getMetadata` for file metadata. Instead, query the `_storage` system table (e.g. using `ctx.db.system.get` to retrieve an `Id<"_storage">`).

  ```ts
  import { query } from "./_generated/server";
  import { Id } from "./_generated/dataModel";

  type FileMetadata = {
      _id: Id<"_storage">;
      _creationTime: number;
      contentType?: string;
      sha256: string;
      size: number;
  }

  export const exampleQuery = query({
      args: { fileId: v.id("_storage") },
      returns: v.null();
      handler: async (ctx, args) => {
          const metadata: FileMetadata | null = await ctx.db.system.get(args.fileId);
          console.log(metadata);
          return null;
      },
  });
  ```

---

# Examples:
## Example: chat-app

### Task

```
Create a real-time chat backend with AI responses. The app should:
- Create users with names.
- Support multiple chat channels.
- Allow users to send messages.
- Auto-generate AI responses.
- Display recent message history.

APIs needed:
1. User management (creation)
2. Channel management (creation)
3. Message operations (sending, listing)
4. AI response generation (using OpenAI's GPT-4)

Messages must include channel, author, and content, maintain order, and show only the 10 most recent messages per channel.

```

### Analysis
1. TASK REQUIREMENTS:
- Build a real-time chat backend with AI integration.
- Support user creation.
- Enable channel-based conversations.
- Store and retrieve messages with proper ordering.
- Generate AI responses automatically.

2. MAIN COMPONENTS:
- Database tables: `users`, `channels`, `messages`
- Public APIs for user/channel management.
- Message handling functions.
- Internal AI response generation.
- Context loading for AI responses.

3. PUBLIC API & INTERNAL FUNCTIONS DESIGN:
Public Mutations:
- Function: `create`
  - File: `convex/users/mutations.ts`
  - Arguments: `{ name: v.string() }`
  - Returns: `v.object({ userId: v.id("users") })`
  - Purpose: Create a new user with a given name.
- Function: `create`
  - File: `convex/channels/mutations.ts`
  - Arguments: `{ name: v.string() }`
  - Returns: `v.object({ channelId: v.id("channels") })`
  - Purpose: Create a new channel with a given name.
- Function: `send`
  - File: `convex/messages/mutations.ts`
  - Arguments: `{ channelId: v.id("channels"), authorId: v.id("users"), content: v.string() }`
  - Returns: `v.null()`
  - Purpose: Send a message to a channel and schedule an AI response.

4. PUBLIC QUERIES:
- Function: `list`
  - File: `convex/messages/queries.ts`
  - Arguments: `{ channelId: v.id("channels") }`
  - Returns:
    ```ts
    v.array(v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      channelId: v.id("channels"),
      authorId: v.optional(v.id("users")),
      content: v.string(),
    }))
    ```
  - Purpose: List the 10 most recent messages from a channel in descending creation order.

5. INTERNAL FUNCTIONS:
- Function: `generate`
  - File: `convex/messages/actions.ts`
  - Arguments: `{ channelId: v.id("channels") }`
  - Returns: `v.null()`
  - Purpose: Generate a response from the AI for a given channel.
- Function: `loadContext`
  - File: `convex/messages/queries.ts`
  - Arguments: `{ channelId: v.id("channels") }`
  - Returns:
    ```ts
    v.array(v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      channelId: v.id("channels"),
      authorId: v.optional(v.id("users")),
      content: v.string(),
    }))
    ```
- Function: `writeAiResponse`
  - File: `convex/messages/mutations.ts`
  - Arguments: `{ channelId: v.id("channels"), content: v.string() }`
  - Returns: `v.null()`
  - Purpose: Write an AI response to a given channel.

4. Schema Design:

Validators:

  ```ts
  // apps/app/convex/users/validators.ts
  export const userFields = { name: v.string() };

  // apps/app/convex/channels/validators.ts
  export const channelFields = { name: v.string() };

  // apps/app/convex/messages/validators.ts
  export const messageFields = {
    channelId: v.id("channels"),
    authorId: v.optional(v.id("users")),
    content: v.string(),
  };
  ```

Schema Fragments:

  ```ts:convex/users/schema.ts
  import { defineTable } from 'convex/server';
  import { userFields } from '#cvx/users/validators';

  export const usersTable = defineTable(userFields);
  ```

  ```ts:convex/channels/schema.ts
  import { defineTable } from 'convex/server';
  import { channelFields } from '#cvx/channels/validators';

  export const channelsTable = defineTable(channelFields);
  ```

  ```ts:convex/messages/schema.ts
  import { defineTable } from 'convex/server';
  import { messageFields } from '#cvx/messages/validators';

  export const messagesTable = defineTable(messageFields)
    .index('by_channel', ['channelId']);
  ```

Schema:

  ```ts:convex/schema.ts
  import { defineSchema } from 'convex/server';

  import { channelsTable } from '#cvx/channels/schema.ts';
  import { messagesTable } from '#cvx/messages/schema.ts';
  import { usersTable } from '#cvx/users/schema.ts';

  const schema = defineSchema({
    channels: channelsTable,
    messages: messagesTable,
    users: usersTable,
    ...
  });

  export default schema;
  ```


5. BACKGROUND PROCESSING:
- AI response generation runs asynchronously after each user message
- Uses OpenAI's GPT-4 to generate contextual responses
- Maintains conversation context using recent message history

### Implementation

#### package.json
```json:package.json
{
  "name": "chat-app",
  "description": "This example shows how to build a chat app without authentication.",
  "version": "1.0.0",
  "dependencies": {
    "convex": "^1.17.4",
    "openai": "^4.79.0"
  }
}
```

#### convex/index.ts

For brevity, these examples are in one file. In your project, organize them by resource and method in the Convex folder (e.g. `convex/users/queries.ts`).

```ts:convex/index.ts
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";
import { internal } from "./_generated/api";

/**
 * Create a user with a given name.
 */
export const createUser = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", { name: args.name });
  },
});

/**
 * Create a channel with a given name.
 */
export const createChannel = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("channels", { name: args.name });
  },
});

/**
 * List the 10 most recent messages from a channel in descending creation order.
 */
export const listMessages = query({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      channelId: v.id("channels"),
      authorId: v.optional(v.id("users")),
      content: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(10);
    return messages;
  },
});

/**
 * Send a message to a channel and schedule a response from the AI.
 */
export const sendMessage = mutation({
  args: {
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    const user = await ctx.db.get(args.authorId);
    if (!user) {
      throw new Error("User not found");
    }
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: args.authorId,
      content: args.content,
    });
    await ctx.scheduler.runAfter(0, internal.index.generateResponse, {
      channelId: args.channelId,
    });
    return null;
  },
});

const openai = new OpenAI();

export const generateResponse = internalAction({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.index.loadContext, {
      channelId: args.channelId,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: context,
    });
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }
    await ctx.runMutation(internal.index.writeAgentResponse, {
      channelId: args.channelId,
      content,
    });
    return null;
  },
});

export const loadContext = internalQuery({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.array(
    v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(10);

    const result = [];
    for (const message of messages) {
      if (message.authorId) {
        const user = await ctx.db.get(message.authorId);
        if (!user) {
          throw new Error("User not found");
        }
        result.push({
          role: "user" as const,
          content: `${user.name}: ${message.content}`,
        });
      } else {
        result.push({ role: "assistant" as const, content: message.content });
      }
    }
    return result;
  },
});

export const writeAgentResponse = internalMutation({
  args: {
    channelId: v.id("channels"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      content: args.content,
    });
    return null;
  },
});
```

---

# Convex Query Types in Next.js

Below are examples of various query patterns.

### `useQuery` Vanilla (Client Components)

```tsx:ui/use-query-vanilla.tsx
// Basic real-time data fetching in client components.
// (This does not persist subscriptions during navigation.)
'use client';

import { useQuery } from 'convex/react';
import { api } from '#cvx/_generated/api';

export default function TaskList() {
  const tasks = useQuery(api.tasks.list);
  return tasks?.map((task) => <div key={task._id}>{task.text}</div>);
}
```

### `useQuery` with Cache (Client Components) – PREFERRED

```tsx:ui/use-query-with-cache.tsx
'use client';

import { useQuery } from 'convex-helpers/react/cache/hooks'; // Next.js specific import.
import { api } from '#cvx/_generated/api';

export default function TaskList() {
  const tasks = useQuery(api.tasks.list);
  return tasks?.map((task) => <div key={task._id}>{task.text}</div>);
}
```

### `usePreloadedQuery` with `preloadQuery` (Hybrid)

```tsx:ui/task-wrapper.tsx
// Hybrid approach for SEO and initial server rendering.
// Server component preloads query data, while the client component consumes it.
import { preloadQuery } from 'convex/nextjs';
import { usePreloadedQuery } from 'convex/react';
import { api } from '#cvx/_generated/api';

// Server Component – Preload data.
export async function TaskWrapper() {
  const preloaded = await preloadQuery(api.tasks.list);
  return <Tasks preloadedTasks={preloaded} />;
}

// Client Component – Use the preloaded query data.
('use client');

export function Tasks({ preloadedTasks }: { preloadedTasks: any }) {
  const tasks = usePreloadedQuery(preloadedTasks);
  return tasks?.map((task: any) => <div key={task._id}>{task.text}</div>);
}
```

### `fetchQuery` (Server Components)

```tsx:ui/static-tasks.tsx
// Pure server-side rendering without real-time updates.
import { fetchQuery } from 'convex/nextjs';
import { api } from '#cvx/_generated/api';

export async function StaticTasks() {
  const tasks = await fetchQuery(api.tasks.list);
  return tasks.map((task) => <div key={task._id}>{task.text}</div>);
}
```

---

# Row Level Security (RLS)

This section configures row-level security policies to enforce access control:
- Only authenticated users can read/modify their own records.
- Admins have elevated permissions.
- Team membership is verified when accessing team data.

```ts:title=convex/rls.ts
import { getAuthUserId } from '@convex-dev/auth/server';
import { customCtx, customQuery } from 'convex-helpers/server/customFunctions';
import { Rules } from 'convex-helpers/server/rowLevelSecurity';
import { DataModel } from '#cvx/_generated/dataModel';
import { query } from './_generated/server';

// Rule context encapsulates the current user's ID and admin status.
type RuleContext = {
  userId: Id<'users'> | null;
  isAdmin: boolean;
};

// Helper: Check if the given user is a super admin using the "by_sys_admin" index.
async function isSysAdmin(ctx: QueryCtx, userId: Id<'users'>): Promise<boolean> {
  return await ctx.db
    .query('users')
    .withIndex('by_sys_admin', (q) => q.eq('systemRole', 'super_admin'))
    .unique()
    .then((user) => user?._id === userId);
}

// Construct RLS rules to enforce access control.
async function rlsRules(ctx: QueryCtx): Promise<Rules<RuleContext, DataModel>> {
  const userId = await getAuthUserId(ctx);
  const isAdmin = userId ? await isSysAdmin(ctx, userId) : false;
  
  return {
    users: {
      read: async ({ userId, isAdmin }, user) =>
        userId !== null && (isAdmin || user._id === userId),
      modify: async ({ userId, isAdmin }, user) =>
        userId !== null && (isAdmin || user._id === userId),
      insert: async ({ isAdmin }) => isAdmin,
    },
    teams: {
      read: async ({ userId }, team) => {
        if (!userId) return false;
        // Verify team membership using the "by_team_user" index.
        const membership = await ctx.db
          .query('teamMembers')
          .withIndex('by_team_user', (q) =>
            q.eq('teamId', team._id).eq('userId', userId)
          )
          .unique();
        return !!membership;
      },
    },
  } satisfies Rules<RuleContext, DataModel>;
}
 
// Wrap queries and mutations with RLS enforcement using a custom context.
export const queryWithRLS = customQuery(
  query,
  customCtx(async (ctx) => ({
    db: wrapDatabaseReader(
      { userId: await getAuthUserId(ctx) },
      ctx.db,
      await rlsRules(ctx)
    ),
  }))
);
```