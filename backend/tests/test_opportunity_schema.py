import unittest

from pydantic import ValidationError

from app.schemas.opportunity_schema import OpportunityCreate, OpportunityUpdate


class OpportunityCreateSchemaTests(unittest.TestCase):
    def test_rejects_whitespace_only_title_and_raw_goal(self):
        with self.assertRaises(ValidationError):
            OpportunityCreate(title="   ", raw_goal="Find SaaS leads")

        with self.assertRaises(ValidationError):
            OpportunityCreate(title="Find leads", raw_goal="   ")

    def test_rejects_title_longer_than_database_column(self):
        with self.assertRaises(ValidationError):
            OpportunityCreate(title="x" * 256, raw_goal="Find SaaS leads")

    def test_trims_title_raw_goal_and_optional_fields(self):
        opportunity = OpportunityCreate(
            title="  Reach SaaS founders  ",
            raw_goal="  Find qualified leads  ",
            target_domain="  saas.example  ",
            target_location="  London  ",
            offer="  Free consultation  ",
        )

        self.assertEqual(opportunity.title, "Reach SaaS founders")
        self.assertEqual(opportunity.raw_goal, "Find qualified leads")
        self.assertEqual(opportunity.target_domain, "saas.example")
        self.assertEqual(opportunity.target_location, "London")
        self.assertEqual(opportunity.offer, "Free consultation")


class OpportunityUpdateSchemaTests(unittest.TestCase):
    def test_fields_remain_optional_and_strings_are_trimmed(self):
        empty_update = OpportunityUpdate()
        self.assertIsNone(empty_update.title)
        self.assertIsNone(empty_update.raw_goal)

        update = OpportunityUpdate(
            title="  Updated title  ",
            raw_goal="  Updated goal  ",
            target_domain="  ",
        )
        self.assertEqual(update.title, "Updated title")
        self.assertEqual(update.raw_goal, "Updated goal")
        self.assertEqual(update.target_domain, "")


if __name__ == "__main__":
    unittest.main()
