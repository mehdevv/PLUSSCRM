import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries/keys";
import {
  createWireframe,
  deleteWireframe,
  getWireframe,
  listWireframes,
  updateWireframe,
} from "@/services/wireframes";
import type { WireframeDocument } from "@/types/wireframe";

export function useWireframes() {
  return useQuery({ queryKey: queryKeys.wireframes, queryFn: listWireframes });
}

export function useWireframe(id: string) {
  return useQuery({
    queryKey: queryKeys.wireframe(id),
    queryFn: () => getWireframe(id),
    enabled: !!id,
  });
}

export function useWireframeMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.wireframes });
  };

  const create = useMutation({
    mutationFn: (title?: string) => createWireframe(title),
    onSuccess: () => invalidate(),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      title,
      document,
      is_published,
    }: {
      id: string;
      title?: string;
      document?: WireframeDocument;
      is_published?: boolean;
    }) => updateWireframe(id, { title, document, is_published }),
    onSuccess: (_data, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: queryKeys.wireframe(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWireframe(id),
    onSuccess: () => invalidate(),
  });

  return { create, update, remove };
}
