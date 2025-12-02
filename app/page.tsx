import { SupportCopilotShell } from "@/components/SupportCopilotShell";
import demoScenarios from "@/demo/tickets.json";

export default async function HomePage() {
  return <SupportCopilotShell initialDocuments={[]} initialAccounts={[]} demoScenarios={demoScenarios} />;
}
