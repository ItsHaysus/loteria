//
//  ViewController.swift
//  Loteria
//
//  Created by Jesus Sanchez on 12/26/18.
//  Copyright © 2018 Jesus Sanchez. All rights reserved.
//

import UIKit

class ViewController: UIViewController {
    @IBOutlet var CardName: UIView!
    @IBOutlet weak var CardView: UIImageView!
    
    
    func LoadImages(){
        if let path = Bundle.main.resourcePath {
            
            let imagePath = path + "/Cards"
            let url = NSURL(fileURLWithPath: imagePath)
            let fileManager = FileManager.default
            
            let properties = [URLResourceKey.localizedNameKey,
                              URLResourceKey.creationDateKey, URLResourceKey.localizedTypeDescriptionKey]
            
            do {
                let imageURLs = try fileManager.contentsOfDirectory(at: url as URL, includingPropertiesForKeys: properties, options:FileManager.DirectoryEnumerationOptions.skipsHiddenFiles)
                
                print("image URLs: \(imageURLs)")
                // Create image from URL
                let randomInt = Int.random(in: 0..<54)
                
                usedCards.append(randomInt)
                let myImage =  UIImage(data: NSData(contentsOf: imageURLs[randomInt])! as Data)
                CardView.image = myImage
            } catch let error1 as NSError {
                print(error1.description)
            }
        }
    }
    
    
    override func viewDidLoad() {
        super.viewDidLoad()
    }


    @IBAction func StartGame(_ sender: Any) {
      LoadImages()
    }

}

