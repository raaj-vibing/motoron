import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/jobs/new")({
  component: () => <Outlet />,
});
