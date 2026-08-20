import { Project, Target } from "@pentest/database";
import type { CreateProjectInput } from "@pentest/shared";
import { HttpError } from "../middleware/errorHandler";

export async function createProject(input: CreateProjectInput, createdBy: string): Promise<Project> {
  return Project.create({
    name: input.name,
    description: input.description ?? null,
    createdBy,
  });
}

export async function listProjects(): Promise<Project[]> {
  return Project.findAll({ order: [["createdAt", "DESC"]] });
}

export async function getProjectOrThrow(projectId: string): Promise<Project> {
  const project = await Project.findByPk(projectId, { include: [{ model: Target, as: "targets" }] });
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  return project;
}
