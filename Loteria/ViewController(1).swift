//
//  ViewController.swift
//  Loteria
//
//  Created by Jesus Sanchez on 12/26/18.
//  Copyright © 2018 Jesus Sanchez. All rights reserved.
//

import UIKit

class ViewController: UIViewController {
    @IBOutlet weak var CardView: UIImageView!
    var usedCards: [Int] = []
    var randomInt: Int = 0
    var imageURLs: [URL] = []
    @IBOutlet weak var cardName: UILabel!
    @IBOutlet weak var AutoCardDealer: UISwitch!
    func LoadImages(){
        if let path = Bundle.main.resourcePath {
            
            let imagePath = path + "/Cards"
            let url = NSURL(fileURLWithPath: imagePath)
            let fileManager = FileManager.default
            
            let properties = [URLResourceKey.localizedNameKey,
                              URLResourceKey.creationDateKey, URLResourceKey.localizedTypeDescriptionKey]
            
            do {
                imageURLs = try fileManager.contentsOfDirectory(at: url as URL, includingPropertiesForKeys: properties, options:FileManager.DirectoryEnumerationOptions.skipsHiddenFiles)
                
                
            } catch let error1 as NSError {
                print(error1.description)
            }
        }
    }
    func CheckIfIntIsOnArray(){
        if(usedCards.contains(randomInt)){
            generateRandomNumbner()
        }
        else{
              usedCards.append(randomInt)
        }
        
    }
    
    func generateRandomNumbner(){
        randomInt = Int.random(in: 0..<54)
        CheckIfIntIsOnArray()

    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        LoadImages()
    }


    @IBAction func ResetGame(_ sender: Any) {
        let viewController = UIViewController()
        let navCtrl = UINavigationController(rootViewController: viewController)
        
        guard
            let window = UIApplication.shared.keyWindow,
            let rootViewController = window.rootViewController
            else {
                return
        }
        
        navCtrl.view.frame = rootViewController.view.frame
        navCtrl.view.layoutIfNeeded()
        
        UIView.transition(with: window, duration: 0.3, options: .transitionCrossDissolve, animations: {
            window.rootViewController = navCtrl
        })
	
    }
    @IBAction func StartGame(_ sender: Any) {
        if(AutoCardDealer.isOn){
            _ = Timer.scheduledTimer(timeInterval: 10, target: self, selector: #selector(ViewController.ChangeCardAfterXseconds), userInfo: nil, repeats: true)
        }
        else{
            CangeCardManually()
        }
    }

    @objc func ChangeCardAfterXseconds(){
        if(usedCards.capacity < 54){
            //generate random number
            generateRandomNumbner()
            let myImage =  UIImage(data: NSData(contentsOf: imageURLs[randomInt])! as Data)
            CardView.image = myImage
            let theFileName = (imageURLs[randomInt].absoluteString as NSString).lastPathComponent
            cardName.text = theFileName
        }
        else{
            usedCards = []
        }

    }
    func CangeCardManually(){
        //generate random number
        generateRandomNumbner()
        let myImage =  UIImage(data: NSData(contentsOf: imageURLs[randomInt])! as Data)
        CardView.image = myImage
        let theFileName = (imageURLs[randomInt].absoluteString as NSString).lastPathComponent
        cardName.text = theFileName
    }
}

