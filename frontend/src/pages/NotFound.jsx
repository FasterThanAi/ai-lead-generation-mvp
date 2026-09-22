import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex justify-center mt-12">
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist or has been moved."
      >
        <Button as={Link} to="/">
          Back to Dashboard
        </Button>
      </EmptyState>
    </div>
  );
}
