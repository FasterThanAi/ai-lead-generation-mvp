import unittest

from pydantic import ValidationError

from app.schemas.lead_schema import LeadCreate


class LeadCreateSchemaTests(unittest.TestCase):
    def test_rejects_blank_company_name(self):
        for blank in ("", " ", "   "):
            with self.assertRaises(ValidationError):
                LeadCreate(campaign_id=1, company_name=blank)

    def test_rejects_company_name_longer_than_database_column(self):
        with self.assertRaises(ValidationError):
            LeadCreate(campaign_id=1, company_name="x" * 256)

    def test_trims_company_name_and_optional_fields(self):
        lead = LeadCreate(
            campaign_id=1,
            company_name="  Acme  ",
            email=" sales@acme.example ",
            website=" https://acme.example ",
        )

        self.assertEqual(lead.company_name, "Acme")
        self.assertEqual(lead.email, "sales@acme.example")
        self.assertEqual(lead.website, "https://acme.example")

    def test_optional_fields_stay_optional(self):
        lead = LeadCreate(campaign_id=1, company_name="Acme")

        self.assertIsNone(lead.email)
        self.assertIsNone(lead.website)


if __name__ == "__main__":
    unittest.main()
