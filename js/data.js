/* EGG MOCKTAIL - all settings and menu in one place. Edit this file to change phone, WhatsApp, prices, menu, admin login. */
window.EM_DATA = {
  "restaurant": {
    "name": "EGG MOCKTAIL",
    "tagline": "An Eggetarian Cafe",
    "base_url": "https://www.eggmocktail.in",
    "phone": "8884138728",
    "whatsapp": "918884138728",
    "address_lines": "Near Marimallapa School, 2nd Phase, Vijayanagar 4th Stage, Bhogadi, Mysuru, Karnataka 570032, India",
    "street_address": "Near Marimallapa School, 2nd Phase, Vijayanagar 4th Stage, Bhogadi",
    "city": "Mysuru",
    "state": "Karnataka",
    "postal_code": "570032",
    "opening_hours": "Opening hours: to be confirmed by the owner.",
    "currency": "₹",
    "timezone": "Asia/Kolkata"
  },
  "location": {
    "_help": "latitude and longitude of the REAL shop door. The values below are the old placeholder pin near Marimallapa School. Change them, then set location_confirmed to true.",
    "latitude": 12.3214771,
    "longitude": 76.5901812,
    "location_confirmed": false,
    "place_link": "https://maps.app.goo.gl/4HBueH9VBYyUBqbB8"
  },
  "social": {
    "_help": "Full links including https://. Leave a value as \"\" to hide that icon.",
    "instagram": "https://www.instagram.com/egg_mocktail?obrf=aThhY3F1ejVnZDNs",
    "youtube": "https://youtube.com/@eggmocktail?si=qpPCiVoUjG02n9_0",
    "twitter_x": "https://x.com/YOUR_X_USERNAME"
  },
  "delivery": {
    "zone_name": "Vijayanagar 4th Stage",
    "zone_radius_km": 1.5,
    "zone_charge": 25,
    "within_km_limit": 6,
    "within_km_charge": 50,
    "above_km_charge": 70
  },
  "site": {
    "sample_menu": true,
    "payment_methods": [
      {
        "id": "cash",
        "label": "Cash on delivery / pickup"
      },
      {
        "id": "upi_on_delivery",
        "label": "UPI when the food arrives (pay the delivery person or shop)"
      }
    ],
    "max_qty_per_item": 20,
    "max_items_in_cart": 100,
    "quote_valid_minutes": 30
  },
  "menu": [
    {
      "id": "starters",
      "name": "Starters",
      "icon": "🍳",
      "image": "cat-starters.svg",
      "items": [
        {
          "id": "starters-egg-vada-pav",
          "name": "Egg Vada Pav",
          "price": 39
        },
        {
          "id": "starters-boiled-egg-3pc",
          "name": "Boiled Egg 3pc",
          "price": 49
        },
        {
          "id": "starters-sunny-side-up-half-boiled",
          "name": "Sunny Side Up (Half Boiled)",
          "price": 29
        },
        {
          "id": "starters-egg-burji",
          "name": "Egg Burji",
          "price": 49
        },
        {
          "id": "starters-egg-omlete",
          "name": "Egg Omlete",
          "price": 49
        },
        {
          "id": "starters-egg-pouch",
          "name": "Egg Pouch",
          "price": 69
        },
        {
          "id": "starters-mushroom-pepper-dry",
          "name": "Mushroom Pepper Dry",
          "price": 89
        },
        {
          "id": "starters-mushroom-chilly",
          "name": "Mushroom Chilly",
          "price": 89
        },
        {
          "id": "starters-baby-corn-dry",
          "name": "Baby Corn Dry",
          "price": 89
        },
        {
          "id": "starters-potato-twister",
          "name": "Potato Twister",
          "price": 59
        }
      ]
    },
    {
      "id": "must-try-starters",
      "name": "Must Try Starters",
      "icon": "⭐",
      "image": "cat-starters.svg",
      "items": [
        {
          "id": "must-try-starters-egg-kanthara",
          "name": "Egg Kanthara",
          "price": 59
        },
        {
          "id": "must-try-starters-bread-omlete",
          "name": "Bread Omlete",
          "price": 59
        },
        {
          "id": "must-try-starters-egg-pepper-dry",
          "name": "Egg Pepper Dry",
          "price": 99
        },
        {
          "id": "must-try-starters-egg-chilly",
          "name": "Egg Chilly",
          "price": 99
        },
        {
          "id": "must-try-starters-egg-manchurian",
          "name": "Egg Manchurian",
          "price": 99
        }
      ]
    },
    {
      "id": "burgers",
      "name": "Burgers",
      "icon": "🍔",
      "image": "cat-burgers.svg",
      "items": [
        {
          "id": "burgers-egg-burger",
          "name": "Egg Burger",
          "price": 79
        },
        {
          "id": "burgers-veg-burger",
          "name": "Veg Burger",
          "price": 69
        },
        {
          "id": "burgers-cheese-burger",
          "name": "Cheese Burger",
          "price": 99
        },
        {
          "id": "burgers-double-egg-burger",
          "name": "Double Egg Burger",
          "price": 89
        },
        {
          "id": "burgers-mushroom-burger",
          "name": "Mushroom Burger",
          "price": 89
        },
        {
          "id": "burgers-paneer-burger",
          "name": "Paneer Burger",
          "price": 89
        },
        {
          "id": "burgers-nashville-burger-hot",
          "name": "Nashville Burger (Hot)",
          "price": 99
        }
      ]
    },
    {
      "id": "sandwiches",
      "name": "Sandwiches",
      "icon": "🥪",
      "image": "cat-sandwiches.svg",
      "items": [
        {
          "id": "sandwiches-egg-sandwich",
          "name": "Egg Sandwich",
          "price": 69
        },
        {
          "id": "sandwiches-veg-sandwich",
          "name": "Veg Sandwich",
          "price": 59
        },
        {
          "id": "sandwiches-egg-cheese-sandwich",
          "name": "Egg Cheese Sandwich",
          "price": 89
        },
        {
          "id": "sandwiches-club-sandwich",
          "name": "Club Sandwich",
          "price": 89
        },
        {
          "id": "sandwiches-mushroom-sandwich",
          "name": "Mushroom Sandwich",
          "price": 79
        },
        {
          "id": "sandwiches-paneer-sandwich",
          "name": "Paneer Sandwich",
          "price": 79
        },
        {
          "id": "sandwiches-nashville-sandwich-hot",
          "name": "Nashville Sandwich (Hot)",
          "price": 89
        }
      ]
    },
    {
      "id": "rolls",
      "name": "Rolls",
      "icon": "🌯",
      "image": "cat-rolls.svg",
      "items": [
        {
          "id": "rolls-egg-roll",
          "name": "Egg Roll",
          "price": 79
        },
        {
          "id": "rolls-veg-roll",
          "name": "Veg Roll",
          "price": 69
        },
        {
          "id": "rolls-egg-cheese-roll",
          "name": "Egg Cheese Roll",
          "price": 99
        },
        {
          "id": "rolls-egg-burji-roll",
          "name": "Egg Burji Roll",
          "price": 89
        },
        {
          "id": "rolls-baby-corn-roll",
          "name": "Baby Corn Roll",
          "price": 89
        },
        {
          "id": "rolls-mushroom-roll",
          "name": "Mushroom Roll",
          "price": 89
        },
        {
          "id": "rolls-paneer-roll",
          "name": "Paneer Roll",
          "price": 89
        },
        {
          "id": "rolls-boiled-egg-roll",
          "name": "Boiled Egg Roll",
          "price": 99
        }
      ]
    },
    {
      "id": "rice",
      "name": "Rice",
      "icon": "🍚",
      "image": "cat-rice.svg",
      "items": [
        {
          "id": "rice-veg-fried-rice",
          "name": "Veg Fried Rice",
          "price": 69
        },
        {
          "id": "rice-egg-fried-rice",
          "name": "Egg Fried Rice",
          "price": 79
        },
        {
          "id": "rice-special-egg-rice",
          "name": "Special Egg Rice",
          "price": 99
        },
        {
          "id": "rice-schezwan-egg-rice",
          "name": "Schezwan Egg Rice",
          "price": 89
        },
        {
          "id": "rice-paneer-egg-rice",
          "name": "Paneer Egg Rice",
          "price": 99
        },
        {
          "id": "rice-mushroom-egg-rice",
          "name": "Mushroom Egg Rice",
          "price": 89
        }
      ]
    },
    {
      "id": "noodles",
      "name": "Noodles",
      "icon": "🍜",
      "image": "cat-noodles.svg",
      "items": [
        {
          "id": "noodles-veg-noodles",
          "name": "Veg Noodles",
          "price": 69
        },
        {
          "id": "noodles-egg-noodles",
          "name": "Egg Noodles",
          "price": 79
        },
        {
          "id": "noodles-schezwan-noodles",
          "name": "Schezwan Noodles",
          "price": 89
        },
        {
          "id": "noodles-paneer-noodles",
          "name": "Paneer Noodles",
          "price": 99
        },
        {
          "id": "noodles-mushroom-noodles",
          "name": "Mushroom Noodles",
          "price": 89
        }
      ]
    },
    {
      "id": "fries",
      "name": "Fries",
      "icon": "🍟",
      "image": "cat-fries.svg",
      "items": [
        {
          "id": "fries-salted-fries",
          "name": "Salted Fries",
          "price": 59
        },
        {
          "id": "fries-peri-peri-fries",
          "name": "Peri Peri Fries",
          "price": 69
        },
        {
          "id": "fries-veg-loaded-fries",
          "name": "Veg Loaded Fries",
          "price": 119
        },
        {
          "id": "fries-egg-loaded-fries",
          "name": "Egg Loaded Fries",
          "price": 129
        },
        {
          "id": "fries-cheese-egg-loaded",
          "name": "Cheese Egg Loaded",
          "price": 139
        }
      ]
    },
    {
      "id": "omelettes",
      "name": "Omelettes",
      "icon": "🍳",
      "image": "cat-omelettes.svg",
      "items": [
        {
          "id": "omelettes-plain-omlete",
          "name": "Plain Omlete",
          "price": 49
        },
        {
          "id": "omelettes-masala-omlete",
          "name": "Masala Omlete",
          "price": 59
        },
        {
          "id": "omelettes-spring-onion-omlete",
          "name": "Spring Onion Omlete",
          "price": 59
        },
        {
          "id": "omelettes-cheese-omlete",
          "name": "Cheese Omlete",
          "price": 69
        },
        {
          "id": "omelettes-bread-omlete",
          "name": "Bread Omlete",
          "price": 59
        },
        {
          "id": "omelettes-spanish-omlete",
          "name": "Spanish Omlete",
          "price": 89
        },
        {
          "id": "omelettes-brocoli-omlete",
          "name": "Brocoli Omlete",
          "price": 89
        },
        {
          "id": "omelettes-maggi-omlete",
          "name": "Maggi Omlete",
          "price": 89
        },
        {
          "id": "omelettes-fluffy-omlete",
          "name": "Fluffy Omlete",
          "price": 99
        }
      ]
    },
    {
      "id": "main-course",
      "name": "Main Course",
      "icon": "🍛",
      "image": "cat-main-course.svg",
      "items": [
        {
          "id": "main-course-egg-biryani",
          "name": "Egg Biryani",
          "price": 99
        },
        {
          "id": "main-course-egg-tawa-pulav",
          "name": "Egg Tawa Pulav",
          "price": 129
        },
        {
          "id": "main-course-neer-dose-egg-curry",
          "name": "Neer Dose Egg Curry",
          "price": 99
        },
        {
          "id": "main-course-jolad-rotti-egg-curry",
          "name": "Jolad Rotti Egg Curry",
          "price": 99
        },
        {
          "id": "main-course-chapati-egg-burji",
          "name": "Chapati Egg Burji",
          "price": 79
        },
        {
          "id": "main-course-egg-dose",
          "name": "Egg Dose",
          "price": 79
        }
      ]
    },
    {
      "id": "combos",
      "name": "Combos",
      "icon": "🎁",
      "image": "cat-combos.svg",
      "items": [
        {
          "id": "combos-burger-combo",
          "name": "Burger Combo",
          "price": 149
        },
        {
          "id": "combos-chapati-combo",
          "name": "Chapati Combo",
          "price": 79
        },
        {
          "id": "combos-dosa-combo",
          "name": "Dosa Combo",
          "price": 79
        }
      ]
    },
    {
      "id": "mocktails",
      "name": "Mocktails",
      "icon": "🍹",
      "image": "cat-mocktails.svg",
      "items": [
        {
          "id": "mocktails-sunrise",
          "name": "Sunrise",
          "price": 89
        },
        {
          "id": "mocktails-rainbow",
          "name": "Rainbow",
          "price": 89
        },
        {
          "id": "mocktails-cindrella",
          "name": "Cindrella",
          "price": 89
        },
        {
          "id": "mocktails-blue-lagoon",
          "name": "Blue Lagoon",
          "price": 69
        },
        {
          "id": "mocktails-kala-khatta",
          "name": "Kala Khatta",
          "price": 69
        },
        {
          "id": "mocktails-lemon-ice-tea",
          "name": "Lemon Ice Tea",
          "price": 69
        },
        {
          "id": "mocktails-green-mint",
          "name": "Green Mint",
          "price": 69
        },
        {
          "id": "mocktails-mojito",
          "name": "Mojito",
          "price": 69
        },
        {
          "id": "mocktails-strawberry",
          "name": "Strawberry",
          "price": 69
        },
        {
          "id": "mocktails-masala-lemonade",
          "name": "Masala Lemonade",
          "price": 69
        },
        {
          "id": "mocktails-black-currant",
          "name": "Black Currant",
          "price": 69
        },
        {
          "id": "mocktails-lychee",
          "name": "Lychee",
          "price": 69
        },
        {
          "id": "mocktails-chilly-guava",
          "name": "Chilly Guava",
          "price": 69
        },
        {
          "id": "mocktails-mango",
          "name": "Mango",
          "price": 69
        },
        {
          "id": "mocktails-pineapple",
          "name": "Pineapple",
          "price": 69
        },
        {
          "id": "mocktails-tropical-fruit-beer",
          "name": "Tropical Fruit Beer",
          "price": 69
        },
        {
          "id": "mocktails-sugarcane",
          "name": "Sugarcane",
          "price": 69
        },
        {
          "id": "mocktails-coconut",
          "name": "Coconut",
          "price": 69
        }
      ]
    },
    {
      "id": "ice-cream",
      "name": "Ice Cream Scoops",
      "icon": "🍨",
      "image": "cat-ice-cream.svg",
      "items": [
        {
          "id": "ice-cream-vanilla",
          "name": "Vanilla",
          "price": 39
        },
        {
          "id": "ice-cream-strawberry",
          "name": "Strawberry",
          "price": 49
        },
        {
          "id": "ice-cream-chocolate",
          "name": "Chocolate",
          "price": 49
        },
        {
          "id": "ice-cream-mango",
          "name": "Mango",
          "price": 49
        },
        {
          "id": "ice-cream-butter-scotch",
          "name": "Butter Scotch",
          "price": 49
        },
        {
          "id": "ice-cream-pista",
          "name": "Pista",
          "price": 49
        }
      ]
    }
  ],
  "admin": {
    "username": "admin",
    "password": "egg@12345"
  }
};
