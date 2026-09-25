import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, projectMembersApi } from '../endpoints/projects';
import type {
  ProjectFilters,
  CreateProjectInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
  AssignProjectManagerInput,
  AddProjectMemberInput,
} from '../../types/entities/project';

export function useProjects(filters: ProjectFilters) {
  return useQuery({ queryKey: ['projects', 'list', filters], queryFn: () => projectsApi.list(filters) });
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: ['projects', 'detail', id], queryFn: () => projectsApi.get(id!), enabled: !!id });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', 'list'] }),
  });
}

function invalidateProject(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['projects', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
  queryClient.invalidateQueries({ queryKey: ['projects', id, 'progress'] });
  queryClient.invalidateQueries({ queryKey: ['projects', id, 'gantt'] });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsApi.update(id, input),
    onSuccess: () => invalidateProject(queryClient, id),
  });
}

export function useUpdateProjectStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectStatusInput) => projectsApi.updateStatus(id, input),
    onSuccess: () => invalidateProject(queryClient, id),
  });
}

export function useAssignProjectManager(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignProjectManagerInput) => projectsApi.assignManager(id, input),
    onSuccess: () => {
      invalidateProject(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'members'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', 'list'] }),
  });
}

// ---- Members (nested) ----

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectMembersApi.list(projectId!),
    enabled: !!projectId,
  });
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddProjectMemberInput) => projectMembersApi.add(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  });
}

export function useUpdateProjectMemberRole(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, role }: { employeeId: string; role: string }) =>
      projectMembersApi.updateRole(projectId, employeeId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => projectMembersApi.remove(projectId, employeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  });
}

export function useProjectGantt(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'gantt'],
    queryFn: () => projectsApi.getGanttData(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectProgress(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'progress'],
    queryFn: () => projectsApi.getProgressAndBudget(projectId!),
    enabled: !!projectId,
  });
}
