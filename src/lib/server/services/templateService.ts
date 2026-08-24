import { prisma } from "@/lib/server/db";
import type { Db } from "@/lib/server/withRLS";
import type { createTemplateSchema } from "@/lib/server/validation";
import type { z } from "zod";

export const templateService = {
  list(db: Db = prisma) {
    return db.emailTemplate.findMany({ orderBy: [{ isSystem: "desc" }, { createdAt: "desc" }] });
  },

  get(id: string, db: Db = prisma) {
    return db.emailTemplate.findUnique({ where: { id } });
  },

  create(input: z.infer<typeof createTemplateSchema>, db: Db = prisma) {
    return db.emailTemplate.create({ data: { ...input, isSystem: false } });
  },

  update(id: string, input: Partial<z.infer<typeof createTemplateSchema>>, db: Db = prisma) {
    return db.emailTemplate.update({ where: { id }, data: input });
  },

  remove(id: string, db: Db = prisma) {
    return db.emailTemplate.delete({ where: { id } });
  },
};
