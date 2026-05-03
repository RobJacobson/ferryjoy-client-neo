/**
 * Convex mutations for ML training snapshots: persist `modelParameters` rows, rename
 * or delete rows by `versionTag`, and write the active production tag to
 * `keyValueStore`. Training pipelines and operator scripts call these; runtime
 * prediction loads coefficients through queries, not these mutations.
 */

import { mutation } from "_generated/server";
import { v } from "convex/values";
import {
  getProductionVersionTagValue,
  upsertByKey,
} from "functions/keyValueStore/helpers";
import { KEY_PRODUCTION_VERSION_TAG } from "functions/keyValueStore/schemas";
import { modelParametersSchema } from "functions/predictions/schemas";

/**
 * Inserts one trained `modelParameters` row.
 *
 * When `versionTag` is `dev-temp` and `bucketType` is `pair`, deletes any existing
 * `dev-temp` row for that `pairKey` and `modelType` first so scratch training runs
 * do not pile up duplicate snapshots. Other tags accumulate as version history.
 *
 * @param ctx - Convex mutation context
 * @param args.model - Full row shape validated by `modelParametersSchema`
 * @returns Inserted document id
 */
export const storeModelParametersMutation = mutation({
  args: {
    model: modelParametersSchema,
  },
  returns: v.id("modelParameters"),
  handler: async (ctx, args) => {
    const { bucketType, pairKey, modelType, versionTag } = args.model;

    // Replace prior dev-temp snapshot so repeated training runs stay single-row.
    if (bucketType === "pair" && pairKey && versionTag === "dev-temp") {
      const existing = await ctx.db
        .query("modelParameters")
        .withIndex("by_pair_type_tag", (q) =>
          q
            .eq("pairKey", pairKey)
            .eq("modelType", modelType)
            .eq("versionTag", "dev-temp")
        )
        .collect();
      for (const doc of existing) {
        await ctx.db.delete(doc._id);
      }
    }

    return await ctx.db.insert("modelParameters", args.model);
  },
});

/**
 * Renames a training snapshot by moving every `modelParameters` row from one
 * `versionTag` to another (insert under `toTag`, then delete the source row).
 *
 * Throws when `fromTag` equals the active production tag in `keyValueStore`, so
 * the configured production label always refers to rows that still exist under
 * that tag until operators switch production first.
 *
 * @param ctx - Convex mutation context
 * @param args.fromTag - Existing snapshot tag to drain
 * @param args.toTag - Destination tag for copied rows
 * @returns Count of rows moved
 */
export const renameVersionTag = mutation({
  args: {
    fromTag: v.string(),
    toTag: v.string(),
  },
  returns: v.object({ renamed: v.number() }),
  handler: async (ctx, args) => {
    const activeProdTag = await getProductionVersionTagValue(ctx);
    if (activeProdTag === args.fromTag) {
      throw new Error(
        `Cannot rename active production version tag "${args.fromTag}". Switch to a different version first.`
      );
    }

    const sourceModels = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.fromTag))
      .collect();

    if (sourceModels.length === 0) {
      throw new Error(`No models found with version tag "${args.fromTag}"`);
    }

    let renamed = 0;
    for (const model of sourceModels) {
      const { _id, _creationTime, ...modelData } = model;
      const newModel = {
        ...modelData,
        versionTag: args.toTag,
      };
      await ctx.db.insert("modelParameters", newModel);
      await ctx.db.delete(_id);
      renamed += 1;
    }

    return { renamed };
  },
});

/**
 * Deletes all `modelParameters` rows for one `versionTag`.
 *
 * Throws when `versionTag` is the active production tag in `keyValueStore`, so
 * production predictions always retain at least one backing row for that tag
 * until operators promote a different tag.
 *
 * @param ctx - Convex mutation context
 * @param args.versionTag - Snapshot tag whose rows are removed
 * @returns Number of rows deleted
 */
export const deleteVersion = mutation({
  args: {
    versionTag: v.string(),
  },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const activeProdTag = await getProductionVersionTagValue(ctx);
    if (activeProdTag === args.versionTag) {
      throw new Error(
        `Cannot delete active production version tag "${args.versionTag}". Switch to a different version first.`
      );
    }

    const models = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .collect();

    for (const model of models) {
      await ctx.db.delete(model._id);
    }

    return { deleted: models.length };
  },
});

/**
 * Sets the active ML production `versionTag` in `keyValueStore`.
 *
 * Requires at least one `modelParameters` row already stored under `versionTag`
 * so operators cannot point production at an empty snapshot. Which row is checked
 * is arbitrary—only existence matters, not a specific terminal pair.
 *
 * @param ctx - Convex mutation context
 * @param args.versionTag - Tag to promote (must already have stored model rows)
 * @returns Completes with `success: true` after `keyValueStore` is updated
 */
export const setProductionVersionTag = mutation({
  args: {
    versionTag: v.string(),
  },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const anyRowForTag = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .first();

    if (!anyRowForTag) {
      throw new Error(
        `Production version tag "${args.versionTag}" does not exist. Create it first by copying a dev version.`
      );
    }

    await upsertByKey(ctx, KEY_PRODUCTION_VERSION_TAG, args.versionTag);

    return { success: true } as const;
  },
});
