import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
  AssignProjectManagerInput,
  ProjectFilters,
  ProjectMember,
  AddProjectMemberInput,
  ProjectProgressAndBudget,
} from '../../types/entities/project';
import type { GanttData } from '../../types/entities/task';

/** Confirmed 1:1 against backend/src/modules/projects/projects.controller.ts. */
export const projectsApi = {
  list: async (filters: ProjectFilters): Promise<{ items: Project[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Project[]>({ method: 'GET', url: '/projects', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Project> => {
    const { data } = await apiRequest<Project>({ method: 'GET', url: `/projects/${id}` });
    return data;
  },
  create: async (input: CreateProjectInput): Promise<Project> => {
    const { data } = await apiRequest<Project>({ method: 'POST', url: '/projects', data: input });
    return data;
  },
  update: async (id: string, input: UpdateProjectInput): Promise<Project> => {
    const { data } = await apiRequest<Project>({ method: 'PATCH', url: `/projects/${id}`, data: input });
    return data;
  },
  updateStatus: async (id: string, input: UpdateProjectStatusInput): Promise<Project> => {
    const { data } = await apiRequest<Project>({ method: 'PATCH', url: `/projects/${id}/status`, data: input });
    return data;
  },
  assignManager: async (id: string, input: AssignProjectManagerInput): Promise<Project> => {
    const { data } = await apiRequest<Project>({ method: 'POST', url: `/projects/${id}/assign-manager`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/projects/${id}` });
  },
  getGanttData: async (projectId: string): Promise<GanttData> => {
    const { data } = await apiRequest<GanttData>({ method: 'GET', url: `/projects/${projectId}/gantt` });
    return data;
  },
  getProgressAndBudget: async (projectId: string): Promise<ProjectProgressAndBudget> => {
    const { data } = await apiRequest<ProjectProgressAndBudget>({ method: 'GET', url: `/projects/${projectId}/progress` });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/projects/project-members.controller.ts — nested under /projects/:projectId/members. */
export const projectMembersApi = {
  list: async (projectId: string): Promise<ProjectMember[]> => {
    const { data } = await apiRequest<ProjectMember[]>({ method: 'GET', url: `/projects/${projectId}/members` });
    return data;
  },
  add: async (projectId: string, input: AddProjectMemberInput): Promise<ProjectMember> => {
    const { data } = await apiRequest<ProjectMember>({ method: 'POST', url: `/projects/${projectId}/members`, data: input });
    return data;
  },
  updateRole: async (projectId: string, employeeId: string, role: string): Promise<ProjectMember> => {
    const { data } = await apiRequest<ProjectMember>({
      method: 'PATCH',
      url: `/projects/${projectId}/members/${employeeId}`,
      data: { role },
    });
    return data;
  },
  remove: async (projectId: string, employeeId: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/projects/${projectId}/members/${employeeId}` });
  },
};
