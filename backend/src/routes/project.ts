import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { scanProject } from "../agent/project-scanner.js";
import { ensureLocalPath } from "../services/repo-manager.js";

/**
 * Project routes — scan and inspect projects.
 */
const projectRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/project/scan
   * Scans a project directory and returns tech stack, file tree, etc.
   */
  app.post<{
    Body: { projectPath: string };
  }>("/project/scan", {
    schema: {
      body: {
        type: "object",
        required: ["projectPath"],
        properties: {
          projectPath: { type: "string", minLength: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      const { projectPath } = request.body;

      try {
        const localPath = await ensureLocalPath(projectPath);
        const info = await scanProject(localPath);
        return reply.send({
          name: info.name,
          techStack: info.techStack,
          fileTree: info.fileTree,
          fileCount: info.fileCount,
          scripts: info.scripts,
          dependencies: Object.keys(info.dependencies),
          devDependencies: Object.keys(info.devDependencies),
        });
      } catch (error) {
        return reply.status(400).send({
          error: "Failed to scan project",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });
};

export default projectRoutes;
