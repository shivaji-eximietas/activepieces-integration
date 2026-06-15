import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { integrationHooks } from '../hooks/integration-hooks';
export function IntegrationHubPage() {
    const { data, isLoading, isError } = integrationHooks.useItems();
    return (_jsxs("div", { className: "flex flex-col gap-4 p-6", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Integration Hub" }), _jsx("p", { className: "text-sm text-gray-500", children: "Data served by the standalone integration-service backend." })] }), isLoading && (_jsx("div", { className: "text-sm text-gray-500", children: "Loading..." })), isError && (_jsx("div", { className: "text-sm text-red-500", children: "Could not reach the integration-service. Make sure it is running on port 4000." })), data && (_jsx("ul", { className: "flex flex-col gap-2", children: data.data.map((item) => (_jsxs("li", { className: "rounded-md border border-gray-200 px-4 py-3 text-sm", children: [_jsx("div", { className: "font-medium", children: item.name }), _jsx("div", { className: "text-gray-400", children: item.id })] }, item.id))) }))] }));
}
