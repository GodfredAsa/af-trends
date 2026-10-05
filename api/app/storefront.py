STOREFRONT_SLOTS = (
    {
        "key": "hero_lookbook",
        "label": "Lookbook — lady in red",
        "hint": "Large homepage photo of the model in red (right of the headline).",
        "fallback": "/photos/hero.jpg",
    },
    {
        "key": "proof_1",
        "label": "Headline circle 1",
        "hint": "First small photo under the home headline.",
        "fallback": "/photos/hero.jpg",
    },
    {
        "key": "proof_2",
        "label": "Headline circle 2",
        "hint": "Second small photo under the home headline.",
        "fallback": "/photos/collection.jpg",
    },
    {
        "key": "proof_3",
        "label": "Headline circle 3",
        "hint": "Third small photo under the home headline.",
        "fallback": "/photos/line.jpg",
    },
    {
        "key": "flash_sale",
        "label": "Flash sale photo",
        "hint": "Photo on the flash sale card.",
        "fallback": "/photos/line.jpg",
    },
    {
        "key": "new_collection",
        "label": "New collection photo",
        "hint": "Photo on the new collection card.",
        "fallback": "/photos/collection.jpg",
    },
)


def slot_map() -> dict[str, dict]:
    return {slot["key"]: slot for slot in STOREFRONT_SLOTS}
