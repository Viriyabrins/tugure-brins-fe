import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

/**
 * SuccessAlert — A green success notification banner.
 *
 * Renders nothing when `message` is falsy, so you can use it inline
 * without wrapping in a conditional:
 *
 *   <SuccessAlert message={successMessage} />
 *
 * @param {{ message: string|null }} props
 */
export default function SuccessAlert({ message }) {
    if (!message) return null;
    return (
        <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
                {message}
            </AlertDescription>
        </Alert>
    );
}
