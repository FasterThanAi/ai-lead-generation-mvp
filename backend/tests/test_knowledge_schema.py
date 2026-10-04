import unittest

from pydantic import ValidationError

from app.schemas.knowledge_schema import CompanyKnowledgeCreate, CompanyKnowledgeUpdate


class CompanyKnowledgeSchemaTests(unittest.TestCase):
    def test_create_rejects_whitespace_only_title(self):
        with self.assertRaises(ValidationError):
            CompanyKnowledgeCreate(title="   ", category="Pricing", content="Plans start at 10")

    def test_create_rejects_whitespace_only_content(self):
        with self.assertRaises(ValidationError):
            CompanyKnowledgeCreate(title="Pricing notes", category="Pricing", content="   ")

    def test_create_trims_title(self):
        entry = CompanyKnowledgeCreate(
            title=" Pricing notes ",
            category="Pricing",
            content=" Plans start at 10 ",
        )

        self.assertEqual(entry.title, "Pricing notes")
        self.assertEqual(entry.content, "Plans start at 10")

    def test_update_rejects_whitespace_only_title_but_allows_omitting_it(self):
        with self.assertRaises(ValidationError):
            CompanyKnowledgeUpdate(title="   ")

        self.assertIsNone(CompanyKnowledgeUpdate(content="New text").title)

    def test_update_trims_title(self):
        self.assertEqual(CompanyKnowledgeUpdate(title=" Pricing notes ").title, "Pricing notes")


if __name__ == "__main__":
    unittest.main()
