import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { organization, project, projectShare, property } from "@/db/schema";

/** Projects shared with a client user (active, unexpired shares only). */
export async function listSharedProjects(userId: string) {
  return db
    .select({
      id: project.id,
      name: project.name,
      status: project.status,
      orgName: organization.name,
      role: projectShare.role,
      streetAddress: property.streetAddress,
      municipality: property.municipality,
      district: property.district,
      livingAreaM2: property.livingAreaM2,
      layout: property.layout,
      buildingType: property.buildingType,
    })
    .from(projectShare)
    .innerJoin(project, eq(projectShare.projectId, project.id))
    .innerJoin(organization, eq(project.organizationId, organization.id))
    .leftJoin(property, eq(property.projectId, project.id))
    .where(and(eq(projectShare.userId, userId), eq(projectShare.status, "active"), gt(projectShare.expiresAt, new Date())))
    .orderBy(desc(project.updatedAt));
}
